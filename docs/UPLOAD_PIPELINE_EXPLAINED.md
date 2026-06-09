# Upload Pipeline — How It Works

> What happens from the moment you drop an Excel file and a PDF into the app to the moment you see your hardware data on screen.

---

## Part 1 — Simple Explanation (No Jargon)

Think of the app as a smart assistant that reads two documents you hand it:

- **The Excel sheet** — your door schedule. A spreadsheet listing every door in the building, its number, size, material, and which hardware "set" it belongs to.
- **The PDF** — your hardware specification. A spec book that describes what each hardware set contains (e.g., Set CA01 = 3 hinges + 1 lever + 1 closer).

The app's job is to read both, understand them, and connect each door to its hardware set.

---

### Step-by-Step in Plain English

#### 1. You upload the Excel file
The app opens the spreadsheet and finds the right sheet (if there are multiple tabs). It reads the column headers and figures out which column means "door number", which means "hardware set", which means "width", etc. — even if your headers use unusual names like "Dr. #" or "Tag" instead of "Door Number". It then reads every row (every door) and stores the data.

#### 2. You upload the PDF
The app tries to read the text directly from the PDF, just like copy-pasting from a document. It splits the PDF into chunks of ~10 pages and sends each chunk to an AI model (Google Gemini), asking it to find and list all hardware sets and their items.

If the text is garbled (e.g., the PDF uses embedded fonts that can't be extracted as readable text), the app switches to a backup plan: it converts each page into a picture and sends the pictures to the AI instead, asking it to "read" the page visually — like a human looking at a scan.

#### 3. AI generates hardware "prep" labels
After extracting the sets, the AI generates a short plain-English label for each set describing its function — e.g., "Hinge + Lever + Elec Strike". This is the industry-standard "prep" description used in hardware schedules.

#### 4. Matching doors to hardware sets
The app takes the door list from the Excel and the hardware sets from the PDF and tries to connect them. Each door row has a "hardware set code" (e.g., "CA01") and each PDF set has a name (e.g., "CA01"). The app matches them up.

It tries several strategies, starting strict and getting looser:
- Exact match: "CA01" === "CA01" ✓
- Number equivalence: "1" === "001" ✓
- Prefix match: "P200" matches "P200 – Elevator Lobby" ✓
- Multi-set: a door assigned to "S2, S4" gets matched to both sets ✓

#### 5. Saving the result
Everything is saved to the database — the door list, the hardware sets, and the final merged result that ties every door to its hardware. This merged result is what powers all the reports and submittal packages you see in the app.

---

## Part 2 — Technical Explanation

The pipeline has three distinct server-side phases with a two-tier AI fallback for the PDF.

---

### Phase 1 — Excel Parsing (`doorScheduleService.ts`)

**Endpoint:** `POST /api/projects/[id]/door-schedule`

1. The uploaded `.xlsx` / `.xls` / `.csv` buffer is passed to `parseDoorSchedule()`.
2. The XLSX library reads the workbook. `selectTargetSheet()` scores each sheet by how many door-schedule headers it contains and picks the best one.
3. `isSectionLabelRow()` detects whether the sheet uses a two-row "sectioned" header format (rows like `BASIC INFORMATION | DOOR | FRAME | HARDWARE` spanning multiple columns) vs a flat single-row header.
4. `buildHeaderMap()` normalises ~100+ header variants (`"door #"`, `"DOOR TAG"`, `"Mark"`, `"Dr. #"` etc.) into canonical camelCase field names (`doorTag`, `width`, `hwSet`).
5. `mapRow()` converts each data row into a typed `DoorScheduleRow` object.
6. Result is upserted to the `door_schedule_imports` Supabase table.

**Output:** `{ rows: DoorScheduleRow[], rowCount, warnings }`

---

### Phase 2 — PDF Extraction (`hardwarePdfServiceV2.ts` + `pdfTextExtractor.ts`)

**Endpoint:** `POST /api/projects/[id]/hardware-pdf`

#### Tier 1 — Text extraction (primary, fast)

1. `extractPdfText()` in `pdfTextExtractor.ts` uses pdfjs server-side to extract text items with their x/y transform coordinates.
2. `reconstructRows()` groups text items by y-coordinate (within a tolerance) and sorts by x — this preserves the visual table structure of hardware schedules rather than flattening all tokens.
3. A garbled-font check tests whether any hardware-specific keywords (`HINGE`, `LOCKSET`, `CLOSER`, etc.) appear in the extracted text. If not → skip to Tier 2.
4. `batchPages()` groups pages into 10-page batches with 1-page overlap (the last page of batch N is prepended as `[CONTEXT]` to batch N+1 to prevent sets from being split across AI calls).
5. Up to 4 batches are sent concurrently to `callOpenRouterForSets()` which calls `google/gemini-2.5-flash` via OpenRouter with a `json_schema` structured output constraint.
6. `mergeBatchSets()` merges sets that span batch boundaries by `setName.toLowerCase()`.

**Skipped if:** file > 15 MB or extracted text is garbled.

#### Tier 2 — Visual fallback (slower)

1. `renderPdfToImages()` uses `@napi-rs/canvas` to render each PDF page to a PNG at 2× resolution.
2. For wide architectural drawings (> 1400 pt), crops to the bottom 45% × right 60% at 3× zoom — targeting the spec table in the lower-right quadrant.
3. All page images are sent as base64 in a single multimodal Gemini call.

**Skipped if:** file > 20 MB.

**Tier selection logic:** Tier 1 runs first. If it returns 0 sets OR throws, Tier 2 runs. Result from whichever tier succeeded is used.

**Output:** `{ sets: ExtractedHardwareSet[], setCount, itemCount, warnings, durationMs, tier: 1|2 }`

---

### Phase 3 — Hardware Prep Generation (`hardwarePrepService.ts`)

After extraction, `generatePrepForAllSets()` sends one batched AI call (Gemini 2.5 Flash) with all sets' item lists and receives back a `{ [setName]: "Hinge + Lever + Elec Strike" }` map. This is non-fatal — if it fails, sets are saved without prep labels and the rest of the pipeline continues.

---

### Phase 4 — Merge (`mergeService.ts`)

**Endpoint:** `POST /api/projects/[id]/process` (combined upload flow)

`mergeHardwareData(pdfSets, doorRows, projectId)` runs after both uploads complete:

1. Three lookup indexes are built: `setIndex` (exact), `prefixIndex` (stripped suffix), `tokenIndex` (multi-value comma-separated names).
2. For each door row, `matchSetName()` tries 5 strategies in order:
   - Exact (case-insensitive)
   - Comma/space normalization (`"S2,S4"` ↔ `"S2, S4"`)
   - Numeric equivalence (`"1"` ↔ `"001"`)
   - Starts-with with separator check (`"P200"` matches `"P200 – Lobby"`)
   - Reverse token match (`"S2"` matches set named `"S2, S4, S5, S6"`)
   - Prefix last-resort (`"ad05e"` matches `"ad05"` if unique)
3. Doors with an empty `hwSet` field → stored under the `__unassigned__` sentinel set.
4. Doors assigned to multiple set codes (e.g., `"P106, P109"`) → linked to all matched sets.
5. Final `MergedHardwareSet[]` is upserted to `project_hardware_finals` in Supabase.

**Output:** `{ sets, setCount, matchedDoorCount, unmatchedDoorCount, unmatchedDoorCodes, pdfSetsWithNoDoors, warnings }`

---

## Part 3 — File Responsibility Map

| Step | What Happens | Files Responsible |
|------|-------------|-------------------|
| Excel upload UI | User selects file, POST is fired | UI component → `app/api/projects/[id]/door-schedule/route.ts` |
| Excel parsing | Sheet selection, header normalization, row mapping | `services/doorScheduleService.ts` |
| PDF upload UI | User selects file, POST is fired | UI component → `app/api/projects/[id]/hardware-pdf/route.ts` |
| PDF text extraction | pdfjs + position-aware row reconstruction | `lib/ai/pdfTextExtractor.ts` |
| PDF visual fallback | Page → PNG → Gemini multimodal | `lib/ai/pdfTextExtractor.ts` → `renderPdfToImages()` |
| AI hardware set parsing | Batched Gemini calls, JSON schema output | `services/hardwarePdfServiceV2.ts` + `lib/ai/generate.ts` |
| Hardware prep labels | Batch AI call for "Hinge + Lever + …" strings | `services/hardwarePrepService.ts` + `lib/ai/generate.ts` |
| Combined upload flow | Runs both parsers then merge in one request | `app/api/projects/[id]/process/route.ts` |
| Door-to-set matching | 5-strategy fuzzy matching | `services/mergeService.ts` |
| Saving results | Upserts to Supabase tables | `app/api/projects/[id]/*.ts` → `lib/supabase/` |
| Reports & submittal | Reads from `finalJson` sections | `services/procurementSummaryService.ts`, `utils/reportGenerator.ts` |

---

## Part 4 — Data Flow at a Glance

```
┌────────────────────────────────────────────────────────────┐
│  USER UPLOADS                                              │
│                                                            │
│   Excel (.xlsx / .csv)         PDF (hardware spec)         │
│         │                              │                   │
│         ▼                              ▼                   │
│  doorScheduleService          hardwarePdfServiceV2         │
│  • selectTargetSheet()        • Tier 1: text extract       │
│  • buildHeaderMap()             pdfjs → AI batches (×4)   │
│  • mapRow() × N rows          • Tier 2 fallback:           │
│                                 pages → PNG → Gemini       │
│         │                              │                   │
│         ▼                              ▼                   │
│  door_schedule_imports    hardware_pdf_extractions          │
│  (Supabase table)         (Supabase table)                  │
│         │                              │                   │
│         └──────────────┬───────────────┘                   │
│                        ▼                                   │
│               mergeService                                 │
│               • 5-strategy matching                        │
│               • __unassigned__ sentinel                    │
│               • multi-set door linking                     │
│                        │                                   │
│                        ▼                                   │
│               project_hardware_finals                      │
│               (Supabase table — source of truth            │
│                for all reports & submittal packages)       │
└────────────────────────────────────────────────────────────┘
```

---

## Part 5 — Key Supabase Tables

| Table | What It Stores |
|-------|---------------|
| `door_schedule_imports` | Parsed door rows from the Excel, one record per import |
| `hardware_pdf_extractions` | Extracted hardware sets from the PDF, one record per import |
| `master_hardware_pending` | New hardware items queued for admin approval before entering the library |
| `project_hardware_finals` | The merged final JSON — every door linked to its hardware set — used by all downstream features |

---

## Notes on the Old System (Being Phased Out)

The codebase contains a legacy upload flow using a **Web Worker** (`workers/upload.worker.ts`) and **IndexedDB** persistence (`utils/uploadPersistence.ts`) managed by `contexts/BackgroundUploadContext.tsx`. This older system processed files client-side using `services/fileUploadService.ts` and `services/hardwarePdfService.ts` (the V1 service). These are all deprecated — the active pipeline is entirely server-side via the API routes described above.
