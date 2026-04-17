# PDF & Excel Upload Architecture
## PlanckOff — Hardware Estimating Platform

---

## 1. What We Are Building

Two independent upload flows per project:

| Flow | Input | Output | DB Table |
|---|---|---|---|
| **PDF Upload** | Hardware specification PDF | JSON array of hardware sets + items | `hardware_pdf_extractions` |
| **Excel Upload** | Door schedule `.xlsx` | JSON array of door rows | `door_schedule_imports` |

Both flows are independent. The merge step (matching sets to doors) is a separate feature, done later.

---

## 2. Current State — What Exists and What's Wrong

### What works
- `utils/pdfParser.ts` — generator-based PDF text extraction with `pdfjs-dist`. Good streaming approach, keep it.
- `utils/xlsxParser.ts` — XLSX parsing with flexible header mapping. Core logic is sound.
- `/api/ai/generate/route.ts` — server-side AI proxy with Gemini + OpenRouter support and retry logic.

### What's wrong (the problems we are solving)

**PDF side:**
- All AI calls are made **client-side** via `aiProviderService.ts` — API keys exposed in browser.
- PDF text is extracted in batches but sent to AI in serial (CONCURRENCY=1) — slow.
- Validation logic duplicated in `fileUploadService.ts` and `geminiService.ts`.
- No storage step — results go straight into React state with no DB persistence.
- JSON repair heuristics in `safeParseJson()` are a 100-iteration regex loop — fragile.

**Excel side:**
- Only reads the **first sheet** — hardcoded, not configurable.
- No server-side step — all parsing happens in the browser.
- No storage step — same React state problem.
- `papaparse` is in dependencies but not used; custom CSV parser used instead.

**Shared:**
- File processing happens inside a Web Worker that is spawned per task — no worker pool.
- Partial results are only in React state, lost on crash.
- The `BackgroundUploadContext` mixes upload queue management with state management.

---

## 3. Architecture Decisions

### Decision 1: Two-phase PDF processing (client text extraction → server AI)

PDF text extraction (pdfjs) must stay client-side — `pdfjs-dist` is a browser library.
But all AI calls **must** go server-side through our `/api/ai/generate` proxy.

```
Browser                          Server
────────────────                 ────────────────────────────
pdfParser.ts                     /api/projects/[id]/hardware-pdf
  ↓ yields text batches    →     receives batches
  (already implemented)          runs AI extraction
                           →     returns structured JSON
                           →     upserts hardware_pdf_extractions row
```

This keeps API keys off the client and makes the extraction auditable.

### Decision 2: Excel parsing is fully server-side

The browser sends the raw file. The server parses it with `xlsx`, normalises headers, and stores the JSON. No client-side parsing code needed for the new flow.

```
Browser                          Server
────────────────                 ────────────────────────────
multipart/form-data POST   →     /api/projects/[id]/door-schedule
                                 xlsx.read(buffer)
                                 normalise headers
                                 map rows → JSON
                                 upsert door_schedule_imports row
                           ←     returns { rowCount, warnings }
```

### Decision 3: Single upsert per project per file type

Each project has exactly one active PDF extraction and one active door schedule import — matching the `UNIQUE (project_id)` constraint on both tables. Re-uploading replaces the previous one. No versioning in Phase 1.

### Decision 4: Keep pdfParser.ts generator, remove fileUploadService.ts AI calls

`fileUploadService.ts` currently does both parsing AND AI calling AND validation. We split this:
- `pdfParser.ts` — text extraction only (unchanged)
- New `services/hardwarePdfService.ts` — batch → AI → normalise → return structured JSON
- API route calls `hardwarePdfService.ts` server-side
- `xlsxParser.ts` — keep header normalisation logic, remove the client-side export path

---

## 4. New File Structure

```
app/
  api/
    projects/
      [id]/
        hardware-pdf/
          route.ts          ← NEW: POST (multipart) — PDF upload + AI extraction
        door-schedule/
          route.ts          ← NEW: POST (multipart) — Excel upload + JSON parse

services/
  hardwarePdfService.ts     ← NEW: server-side PDF batch→AI→JSON pipeline
  doorScheduleService.ts    ← NEW: server-side Excel→JSON normalisation

lib/
  db/
    hardware.ts             ← NEW: DB operations for hardware_pdf_extractions,
                                   door_schedule_imports, project_hardware_finals

utils/
  pdfParser.ts              ← KEEP: text extraction (no changes)
  xlsxParser.ts             ← KEEP: header normalisation logic (remove client export)
```

---

## 5. API Route Contracts

### POST `/api/projects/[id]/hardware-pdf`

**Request:** `multipart/form-data` with field `file` (PDF)

**Server steps:**
1. Auth check (`withAuth`)
2. Validate file: must be `application/pdf`, max 50MB
3. Receive file buffer
4. Extract text from PDF pages using `pdfParser` (server-compatible path via `pdfjs-dist/legacy/build/pdf`)
5. For each batch of pages → call AI → collect structured hardware sets
6. Normalise result to canonical JSON shape (see Section 7)
7. Upsert row in `hardware_pdf_extractions`
8. Return `{ data: { id, setCount, itemCount } }`

**Response (success):**
```json
{
  "data": {
    "id": "uuid",
    "setCount": 12,
    "itemCount": 87
  }
}
```

---

### POST `/api/projects/[id]/door-schedule`

**Request:** `multipart/form-data` with field `file` (`.xlsx` or `.csv`)

**Server steps:**
1. Auth check (`withAuth`)
2. Validate file: must be `.xlsx` or `.csv`, max 20MB
3. Parse file to JSON rows using `xlsxParser` / `papaparse`
4. Normalise column headers to camelCase canonical names (see Section 7)
5. Upsert row in `door_schedule_imports`
6. Return `{ data: { id, rowCount, warnings } }`

**Response (success):**
```json
{
  "data": {
    "id": "uuid",
    "rowCount": 143,
    "warnings": ["Sheet 'Excluded Doors' was skipped"]
  }
}
```

---

## 6. Service Layer

### `services/hardwarePdfService.ts`

```typescript
// Server-only. Never import from client components.

export interface HardwarePdfResult {
  sets: ExtractedHardwareSet[];
  warnings: string[];
  pageCount: number;
}

export interface ExtractedHardwareSet {
  setName: string;           // e.g. "AD01b"
  hardwareItems: ExtractedHardwareItem[];
  notes?: string;
}

export interface ExtractedHardwareItem {
  qty: number;
  item: string;              // "Exit Device"
  manufacturer: string;      // "Sargent"
  description: string;       // part number / spec
  finish: string;            // "626"
}

export async function extractHardwareSetsFromPdf(
  buffer: Buffer,
  options: { provider: AIProvider; model: string; apiKey: string }
): Promise<HardwarePdfResult>
```

Internally this function:
1. Uses `pdfjs-dist` to extract text in batches of 10 pages
2. For each batch calls the AI with a structured prompt
3. Merges partial results (same set name across batches → merge items)
4. Returns the final canonical array

### `services/doorScheduleService.ts`

```typescript
export interface DoorScheduleResult {
  rows: DoorScheduleRow[];
  warnings: string[];
  rowCount: number;
}

export interface DoorScheduleRow {
  doorTag: string;
  hwSet: string;             // "AD09a" — the join key for merging later
  buildingArea?: string;
  roomNumber?: string;
  doorLocation?: string;
  interiorExterior?: string;
  quantity?: number;
  wallType?: string;
  throatThickness?: string;
  fireRating?: string;
  leafCount?: string;
  doorType?: string;
  doorWidth?: string;
  doorHeight?: string;
  thickness?: string;
  doorWidthMm?: string;
  doorHeightMm?: string;
  doorMaterial?: string;
  doorFinish?: string;
  glazingType?: string;
  frameType?: string;
  frameMaterial?: string;
  frameFinish?: string;
  hardwareSet?: string;      // human label e.g. "STOREROOM LOCKSET"
  hardwarePrep?: string;
  hardwareOnDoor?: string;
  hasCardReader?: boolean;
  hasKeyPad?: boolean;
  hasAutoOperator?: boolean;
  hasPrivacySet?: boolean;
  hasKeyedLock?: boolean;
  hasPushPlate?: boolean;
  hasAntiBarricade?: boolean;
  hasKickPlate?: boolean;
  hasFrameProtection?: boolean;
  hasDoorCloser?: boolean;
  comments?: string;
  excludeReason?: string;
}

export function parseDoorSchedule(
  buffer: Buffer,
  filename: string
): DoorScheduleResult
```

---

## 7. Canonical JSON Shapes (stored in DB)

### `hardware_pdf_extractions.extracted_json`
```json
[
  {
    "setName": "AD01b",
    "hardwareItems": [
      {
        "qty": 2,
        "item": "Exit Device",
        "manufacturer": "Sargent",
        "description": "56-NB-PE8613 x WEJ x hand",
        "finish": "626"
      }
    ],
    "notes": "Hardware notes if any"
  }
]
```

### `door_schedule_imports.schedule_json`
```json
[
  {
    "doorTag": "1109",
    "hwSet": "AD09a",
    "buildingArea": "LEVEL 01",
    "doorLocation": "CAFETERIA",
    "fireRating": "45 MIN.",
    "doorMaterial": "HOLLOW METAL",
    "hasAutoOperator": true,
    "hasKeyedLock": true,
    "comments": "FREE EGRESS AT ALL TIMES"
  }
]
```

Note: All column header variations from Excel are normalised to this camelCase shape by the server before storage. This is the contract the merge step will rely on.

---

## 8. DB Operations (`lib/db/hardware.ts`)

```typescript
// Upsert — replaces any existing row for this project
upsertHardwarePdfExtraction(projectId, payload): Promise<DbResult<HardwarePdfExtraction>>
upsertDoorScheduleImport(projectId, payload): Promise<DbResult<DoorScheduleImport>>

// Read
getHardwarePdfExtraction(projectId): Promise<DbResult<HardwarePdfExtraction | null>>
getDoorScheduleImport(projectId): Promise<DbResult<DoorScheduleImport | null>>

// Final JSON (set after merge step)
upsertProjectHardwareFinal(projectId, payload): Promise<DbResult<ProjectHardwareFinal>>
getProjectHardwareFinal(projectId): Promise<DbResult<ProjectHardwareFinal | null>>
```

---

## 9. Client-Side Upload Components

The UI uploads files directly to the API routes via `fetch` with `FormData`. No client-side parsing. No Web Worker needed for this flow.

```typescript
// In the project view component
async function uploadHardwarePdf(projectId: string, file: File) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/projects/${projectId}/hardware-pdf`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  return res.json();
}

async function uploadDoorSchedule(projectId: string, file: File) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/projects/${projectId}/door-schedule`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });

  return res.json();
}
```

For large PDFs (many pages), the API response will take time. The route streams nothing — it returns once complete. If we need progress later, we add Server-Sent Events. For now, a loading state is sufficient.

---

## 10. What We Are NOT Doing Yet

- **Merge step** (matching hwSet → setName) — separate feature, next phase
- **Re-using existing `BackgroundUploadContext`** — the new flow does not need it; direct API calls are simpler
- **Multi-file batch uploads** — one file at a time per type per project
- **Versioning / history** of uploads — single upsert, previous data is replaced
- **Server-Sent Events for progress** — can add later if needed for very large PDFs

---

## 11. Implementation Order

1. `lib/db/hardware.ts` — DB layer first (foundation everything else depends on)
2. `services/doorScheduleService.ts` — simpler, no AI, validate approach
3. `app/api/projects/[id]/door-schedule/route.ts` — wire up Excel upload
4. `services/hardwarePdfService.ts` — AI extraction service
5. `app/api/projects/[id]/hardware-pdf/route.ts` — wire up PDF upload
6. UI upload components in ProjectView — connect to new API routes

---

## 12. Out of Scope (Existing Code to Leave Alone)

The following existing services/components handle the **old React-state-only flow** used elsewhere in the app (ProjectView hardware editing, manual entry, etc.). Do not touch them:

- `services/fileUploadService.ts`
- `services/geminiService.ts`
- `workers/upload.worker.ts`
- `contexts/BackgroundUploadContext.tsx`
- `utils/csvParser.ts`
- `components/HardwareSetsManager.tsx`

They will be deprecated gradually as the new flow proves out.
