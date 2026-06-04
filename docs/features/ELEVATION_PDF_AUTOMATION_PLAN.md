# Elevation PDF Auto-Extraction — Implementation Plan

## Feasibility Verdict: YES, Fully Possible

---

## The Correct Mental Model

This feature runs **after** the main pipeline (Excel + door schedule PDF), not alongside it.

```
STEP 1 (existing pipeline — already works):
  Excel upload → AI extracts door data → final JSON
  → Each door already has an elevation type code (e.g. "TYPE A1", "DG2")
  → ElevationType records already exist in the DB with codes
  → But: no image, no description on those ElevationType records yet

STEP 2 (this feature — what we're building):
  User uploads the elevation drawing PDF
  → AI scans each page, finds each elevation drawing
  → For each drawing, reads:
       • Type code label  (e.g. "TYPE A1")
       • Description text (e.g. "SINGLE HOLLOW METAL DOOR")
       • Bounding box for cropping
  → Match type code → existing ElevationType record (by code)
  → Crop image, upload to Supabase
  → UPDATE ElevationType with: imageUrl + description
  → Done — doors are already linked, nothing else needed
```

**The door-to-elevation matching is already done by the pipeline.** This feature's only job is to enrich the existing `ElevationType` records with images and descriptions from the PDF.

---

## What the AI Reads From Each Drawing

From the sample image provided:

```
┌──────────────────────────┐
│                          │
│   [elevation drawing]    │
│                          │
│                          │
└──────────────────────────┘
         TYPE A1                ← type code label (bold)
   SINGLE HOLLOW METAL DOOR     ← description (below the code)
```

The AI must return three things per drawing:
- **`typeCode`** — the code that matches an existing ElevationType (`TYPE A1`, `DG2`, etc.)
- **`description`** — the human-readable label below the code (`SINGLE HOLLOW METAL DOOR`)
- **`boundingBox`** — normalized coordinates for cropping the drawing (the rectangular diagram, NOT including the text labels below)

---

## UI Entry Point: Separate Page, Not Inside ElevationManager

The existing `ElevationManager.tsx` modal is **untouched**. Users still access it for manual management.

A **new button** is added to the `DoorScheduleManager` toolbar. It opens a **dedicated full-screen page** for PDF-based enrichment.

```
DoorScheduleManager toolbar — BEFORE:
  [Layers — Manage Elevation Types]  [Upload Door Schedule]  ...

DoorScheduleManager toolbar — AFTER:
  [Layers — Manage Elevation Types]  [FileSearch — Extract Elevations from PDF]  [Upload Door Schedule]  ...
```

**Important:** This button should only be enabled after the pipeline has run (i.e. after doors and elevation types exist). If no ElevationType records exist yet, show a tooltip: `"Run the door schedule pipeline first to detect elevation types"`.

---

## How AI Calls Work

All AI calls route through OpenRouter by default:

```
generateAIContent() in aiProviderService.ts
  → POST /api/ai/generate (server-side, keys never exposed)
    → generateWithOpenRouter()  ← default (google/gemini-2.0-flash-001)
    OR generateWithGemini()     ← when provider='gemini' in settings
```

The current route has **no image/vision support**. `GenerateRequestBody` has no `imageBase64` field. This must be added first.

---

## End-to-End User Flow

```
1. Pipeline has already run — doors + ElevationType records exist in DB
   (ElevationTypes have codes like "TYPE A1" but no image, no description)

2. User clicks [Extract Elevations from PDF] in the toolbar

3. Full-screen ElevationExtractorPage opens

4. Upload stage:
   ┌────────────────────────────────────────────────┐
   │  Drop your elevation drawing PDF here          │
   │  or click to browse                            │
   │  PDF only · max 15 MB                          │
   │                                                │
   │  Elevation types ready to fill: 6              │
   │  (TYPE A1, TYPE B1, TYPE B2, DG2, AG2, NL4)   │
   └────────────────────────────────────────────────┘

5. Processing stage:
   "Rendering pages…              20%"
   "Scanning page 2 for drawings… 45%"
   "Cropping elevations…          80%"

6. Review stage — grid of cards, one per matched ElevationType:
   ┌──────────────┬──────────────┬──────────────┬──────────────┐
   │  [img crop]  │  [img crop]  │  [img crop]  │  [img crop]  │
   │              │              │              │              │
   │   TYPE A1    │   TYPE B1    │   TYPE B2    │    DG2       │
   │  Single HM   │  Bipart HM   │  Bipart HM   │  Alum/Glass  │
   │  Door        │  Door        │  w/ Sidelight│  Door        │
   │  ✅ matched  │  ✅ matched  │  ✅ matched  │  ✅ matched  │
   └──────────────┴──────────────┴──────────────┴──────────────┘

   Unmatched PDF drawings (type code not found in DB):
   ┌──────────────┐
   │  [img crop]  │
   │   TYPE C3    │  ← found in PDF but no ElevationType with code "C3" exists
   │  ⚠️ no match │
   │  [skip]      │
   └──────────────┘

   ElevationTypes not found in PDF:
   ℹ️  2 elevation types in your project were not found in this PDF: NL4, F1

7. User reviews, optionally edits descriptions, clicks [Save X Elevations]

8. On save:
   → Uploads each cropped image to Supabase
   → Updates each ElevationType record: imageUrl, imagePath, description
   → Toasts: "6 elevation types updated"
   → Page closes

9. Doors already linked to those ElevationTypes now show their images
   in the door schedule view automatically.
```

---

## Infrastructure Dependencies

| Dependency | Status | File |
|---|---|---|
| PDF → Canvas rendering | **Ready** — `pdfjs-dist` 5.4.530 | `utils/pdfParser.ts` |
| AI Vision — detect drawings + read labels | **Needs 1 extension** — no image field in route | `app/api/ai/generate/route.ts` |
| AI client | **Needs 1 param** — `imageBase64` option | `services/aiProviderService.ts` |
| Image compression + upload | **Ready** — `compressElevationImage()`, `uploadElevationImage()` | `services/elevationService.ts` |
| ElevationType matching | **Ready** — match by `code` or `name` field | existing `ElevationType[]` in project state |
| ElevationType update | **Needs check** — verify there is a service/API call to update an existing ElevationType record | `services/` or Supabase direct |

**No new npm packages needed.**

---

## Files To Create (3 new files)

| File | Purpose |
|---|---|
| `constants/elevationExtraction.ts` | Config constants |
| `services/elevationExtractorService.ts` | Orchestration: render → AI detect → crop → match → stage for save |
| `components/elevation/ElevationExtractorPage.tsx` | Full-screen UI: upload → progress → review grid → save |

## Files To Modify (5 existing files)

| File | Change | Touches existing logic? |
|---|---|---|
| `types.ts` | Add 2 new interfaces | No — append only |
| `utils/pdfParser.ts` | Add `renderPDFPagesAsImages()` | No — new export only |
| `app/api/ai/generate/route.ts` | Add `imageBase64` field + vision message format | Minimal — 1 new field + conditional |
| `services/aiProviderService.ts` | Add `imageBase64` to `generateAIContent()` options | Minimal — 1 optional param |
| `components/doorSchedule/DoorScheduleManager.tsx` | Add button + `onExtractElevations` prop | Minimal — 1 button in toolbar |
| `views/ProjectView.tsx` | Add state + render `ElevationExtractorPage` | Minimal — same pattern as ElevationManager |

**`ElevationManager.tsx` — NOT TOUCHED.**

---

## Implementation Steps

### Step 1 — Types (`types.ts`)

```typescript
// What the AI returns per detected elevation drawing
export interface DetectedElevationDrawing {
  typeCode: string;        // e.g. "TYPE A1", "DG2" — used to match ElevationType.code
  description: string;     // e.g. "SINGLE HOLLOW METAL DOOR"
  boundingBox: {
    x: number;             // normalized 0–1, top-left origin
    y: number;
    width: number;
    height: number;
  };
  labelConfidence: number; // 0–1, how clearly typeCode was read
  pageNumber: number;
}

// Result of the analysis phase (before save)
export interface ElevationPDFAnalysisResult {
  // Drawings found in PDF that match an existing ElevationType by code
  matched: Array<{
    elevationTypeId: string;     // existing ElevationType.id
    elevationTypeCode: string;   // e.g. "TYPE A1"
    description: string;         // extracted from PDF
    croppedImageBase64: string;  // held in memory until user saves
    pageNumber: number;
    labelConfidence: number;
  }>;
  // Drawings found in PDF but no ElevationType with that code exists
  unmatched: Array<{
    typeCode: string;
    description: string;
    croppedImageBase64: string;
    pageNumber: number;
  }>;
  // ElevationType records that exist in DB but were NOT found in the PDF
  notFoundInPDF: Array<{
    elevationTypeId: string;
    elevationTypeCode: string;
  }>;
  totalPagesScanned: number;
  totalDrawingsFound: number;
}
```

---

### Step 2 — Constants (`constants/elevationExtraction.ts`)

```typescript
export const ELEVATION_EXTRACTION = {
  PDF_RENDER_SCALE: 2.0,           // 2x for LLM to read small labels
  MIN_LABEL_CONFIDENCE: 0.6,       // below this → skip (unreadable label)
  CROP_PADDING_PERCENT: 0.04,      // 4% padding around bounding box
  MAX_FILE_SIZE_MB: 15,
  SUPPORTED_FILE_TYPES: ['application/pdf'],
} as const;
```

---

### Step 3 — PDF Page Renderer (`utils/pdfParser.ts`)

New exported generator. Do not touch `extractTextGenerator`.

```typescript
export interface PDFPageImageResult {
  pageNumber: number;
  totalPages: number;
  imageBase64: string;   // data:image/jpeg;base64,...
  progress: number;      // 0–100
}

export async function* renderPDFPagesAsImages(
  file: File,
  options?: { scale?: number }
): AsyncGenerator<PDFPageImageResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';   // same as existing pattern

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const scale = options?.scale ?? 2.0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    let imageBase64: string;
    try {
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as any, viewport }).promise;
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      bytes.forEach(b => (binary += String.fromCharCode(b)));
      imageBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
    } catch {
      // Safari < 16.4 fallback
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx as any, viewport }).promise;
      imageBase64 = canvas.toDataURL('image/jpeg', 0.92);
    }

    page.cleanup();
    await new Promise(r => setTimeout(r, 5));

    yield {
      pageNumber: pageNum,
      totalPages: numPages,
      imageBase64,
      progress: Math.round((pageNum / numPages) * 100),
    };
  }
}
```

---

### Step 4 — Vision Support in the AI Route

Two minimal changes.

#### 4a. `app/api/ai/generate/route.ts`

```typescript
// Add to GenerateRequestBody:
imageBase64?: string;   // optional base64 image for vision calls

// Add to body destructure:
const { prompt, schema, provider, model, temperature, imageBase64 } = body;

// Pass imageBase64 into both generator functions.

// In generateWithOpenRouter — change messages content:
content: imageBase64
  ? [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: imageBase64 } },
    ]
  : prompt,

// In generateWithGemini — change contents:
contents: imageBase64
  ? {
      parts: [
        { text: fullPrompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64.replace(/^data:image\/\w+;base64,/, '') } },
      ],
    }
  : fullPrompt,
```

#### 4b. `services/aiProviderService.ts`

```typescript
// Add to options:
imageBase64?: string;

// Add to fetch body:
body: JSON.stringify({ prompt, schema, provider, model, temperature, imageBase64: options?.imageBase64 }),
```

---

### Step 5 — Extractor Service (`services/elevationExtractorService.ts`)

New file with four functions.

#### 5a. `scanPageForElevations()` — AI vision call per page

```typescript
async function scanPageForElevations(
  pageImageBase64: string,
  pageNumber: number,
): Promise<DetectedElevationDrawing[]> {
  const prompt = `You are analyzing one page from an architectural elevation drawing PDF.

Find every elevation drawing on this page. An elevation drawing is a rectangular front-view diagram of a door or door frame, typically arranged in a grid layout on the page.

For each drawing, extract:

1. typeCode — the bold type label directly below the drawing
   Examples: "TYPE A1", "TYPE B2", "DG2", "AG2", "NL4"
   This is usually in bold and is the primary identifier.

2. description — the descriptive text below the typeCode (if present)
   Examples: "SINGLE HOLLOW METAL DOOR", "BIPART HOLLOW METAL DOOR", "ALUMINUM GLASS DOOR"
   If no description text exists below the code, return an empty string.

3. boundingBox — normalized 0–1 coordinates of the DRAWING ONLY (the rectangular diagram, NOT the text labels below it)
   { x: left edge, y: top edge, width: drawing width, height: drawing height }
   0,0 = top-left of the full page image.

4. labelConfidence — 0–1, how clearly you could read the typeCode label

Return [] if the page has no elevation drawings (e.g. it is a title page or text schedule).
Do not include drawings cut off at page edges.
Return ONLY valid JSON matching the schema — no explanation text.`;

  const schema = {
    type: 'array',
    items: {
      type: 'object',
      required: ['typeCode', 'description', 'boundingBox', 'labelConfidence'],
      properties: {
        typeCode: { type: 'string' },
        description: { type: 'string' },
        boundingBox: {
          type: 'object',
          required: ['x', 'y', 'width', 'height'],
          properties: {
            x: { type: 'number' }, y: { type: 'number' },
            width: { type: 'number' }, height: { type: 'number' },
          },
        },
        labelConfidence: { type: 'number' },
      },
    },
  };

  const { text } = await generateAIContent(prompt, schema, {
    temperature: 0.1,
    imageBase64: pageImageBase64,
  });

  try {
    return (JSON.parse(text) as Omit<DetectedElevationDrawing, 'pageNumber'>[])
      .map(d => ({ ...d, pageNumber }));
  } catch {
    return [];
  }
}
```

#### 5b. `cropDrawingFromPage()` — Crop bounding box from page image

```typescript
async function cropDrawingFromPage(
  pageImageBase64: string,
  boundingBox: { x: number; y: number; width: number; height: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.width;
      const H = img.height;
      const pad = ELEVATION_EXTRACTION.CROP_PADDING_PERCENT;

      const sx = Math.max(0, (boundingBox.x - pad) * W);
      const sy = Math.max(0, (boundingBox.y - pad) * H);
      const sw = Math.min(W - sx, (boundingBox.width + pad * 2) * W);
      const sh = Math.min(H - sy, (boundingBox.height + pad * 2) * H);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/webp', 0.92));
    };
    img.onerror = reject;
    img.src = pageImageBase64;
  });
}
```

#### 5c. `normalizeTypeCode()` — Normalize for matching

```typescript
function normalizeTypeCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/^TYPE\s+/, '')          // strip "TYPE " prefix
    .replace(/[^A-Z0-9]/g, '')        // strip non-alphanumeric
    .replace(/^0+/, '');              // strip leading zeros
}
```

#### 5d. `analyzeElevationPDF()` — Main orchestrator (analysis only, no uploads)

```typescript
export async function analyzeElevationPDF(
  file: File,
  existingElevationTypes: ElevationType[],
  onProgress?: (stage: string, percent: number) => void,
): Promise<ElevationPDFAnalysisResult> {
  const result: ElevationPDFAnalysisResult = {
    matched: [],
    unmatched: [],
    notFoundInPDF: [],
    totalPagesScanned: 0,
    totalDrawingsFound: 0,
  };

  // Track which ElevationTypes were found in the PDF
  const foundTypeCodes = new Set<string>();

  // Stage 1: Render pages (0–30%)
  onProgress?.('Rendering PDF pages…', 0);
  const pageImages: Array<{ pageNumber: number; imageBase64: string }> = [];
  for await (const page of renderPDFPagesAsImages(file, { scale: ELEVATION_EXTRACTION.PDF_RENDER_SCALE })) {
    pageImages.push({ pageNumber: page.pageNumber, imageBase64: page.imageBase64 });
    onProgress?.('Rendering PDF pages…', Math.round(page.progress * 0.3));
  }

  // Stage 2: AI scan per page (30–80%)
  for (let i = 0; i < pageImages.length; i++) {
    const { pageNumber, imageBase64 } = pageImages[i];
    onProgress?.(`Scanning page ${pageNumber} of ${pageImages.length}…`, 30 + Math.round((i / pageImages.length) * 50));

    let drawings: DetectedElevationDrawing[];
    try {
      drawings = await scanPageForElevations(imageBase64, pageNumber);
    } catch {
      continue;  // skip page on AI failure
    }

    result.totalPagesScanned++;
    result.totalDrawingsFound += drawings.length;

    // Stage 3: Crop + match each drawing (woven into stage 2 progress)
    for (const drawing of drawings) {
      if (drawing.labelConfidence < ELEVATION_EXTRACTION.MIN_LABEL_CONFIDENCE) continue;

      let croppedBase64: string;
      try {
        croppedBase64 = await cropDrawingFromPage(imageBase64, drawing.boundingBox);
      } catch {
        continue;
      }

      // Match the detected typeCode against existing ElevationType records
      const normDetected = normalizeTypeCode(drawing.typeCode);
      const matchedType = existingElevationTypes.find(et =>
        normalizeTypeCode(et.code) === normDetected ||
        normalizeTypeCode(et.name) === normDetected
      );

      if (matchedType) {
        foundTypeCodes.add(matchedType.code);
        result.matched.push({
          elevationTypeId: matchedType.id,
          elevationTypeCode: matchedType.code,
          description: drawing.description,
          croppedImageBase64: croppedBase64,
          pageNumber,
          labelConfidence: drawing.labelConfidence,
        });
      } else {
        result.unmatched.push({
          typeCode: drawing.typeCode,
          description: drawing.description,
          croppedImageBase64: croppedBase64,
          pageNumber,
        });
      }
    }
  }

  // Which ElevationTypes in the DB were NOT found in this PDF
  result.notFoundInPDF = existingElevationTypes
    .filter(et => !foundTypeCodes.has(et.code))
    .map(et => ({ elevationTypeId: et.id, elevationTypeCode: et.code }));

  onProgress?.('Analysis complete', 100);
  return result;
}
```

#### 5e. `saveElevationEnrichments()` — Upload + update on user confirm

Called only when the user clicks Save on the review grid.

```typescript
export async function saveElevationEnrichments(
  items: Array<{
    elevationTypeId: string;
    elevationTypeCode: string;
    description: string;
    croppedImageBase64: string;
    kind: 'door' | 'frame';
  }>,
  projectId: string,
): Promise<Array<{ id: string; imageUrl: string; imagePath: string; description: string }>> {
  const results = [];

  for (const item of items) {
    const response = await fetch(item.croppedImageBase64);
    const blob = await response.blob();
    const imageFile = new File([blob], `${item.elevationTypeCode}.webp`, { type: 'image/webp' });

    const compressed = await compressElevationImage(imageFile);
    const { url, path } = await uploadElevationImage(projectId, item.elevationTypeCode, compressed, item.kind);

    results.push({
      id: item.elevationTypeId,
      imageUrl: url,
      imagePath: path,
      description: item.description,
    });
  }

  return results;
}
```

---

### Step 6 — Extractor Page (`components/elevation/ElevationExtractorPage.tsx`)

Full-screen overlay. Opens from ProjectView, not from ElevationManager.

**Props:**

```typescript
interface ElevationExtractorPageProps {
  projectId: string;
  existingElevationTypes: ElevationType[];   // from project state — already have codes
  onSave: (updates: Array<{ id: string; imageUrl: string; imagePath: string; description: string }>) => void;
  onClose: () => void;
}
```

**Stages:**

```
'idle'       → upload dropzone shown
'processing' → progress bar + stage label
'review'     → grid of matched cards + unmatched section + not-found note
'saving'     → spinner while uploading to Supabase
```

**Review grid card layout:**

```
┌─────────────────────────────────┐
│                                 │
│      [cropped elevation image]  │
│                                 │
│  TYPE A1                        │ ← typeCode (read-only)
│  ┌───────────────────────────┐  │
│  │ Single Hollow Metal Door  │  │ ← description (editable text input)
│  └───────────────────────────┘  │
│  ✅ Matches existing type       │ ← match status
└─────────────────────────────────┘
```

For unmatched drawings (type code not found in DB):

```
┌─────────────────────────────────┐
│      [cropped image]            │
│  TYPE C3  ⚠️ not in project     │
│  [skip this drawing]   [×]      │
└─────────────────────────────────┘
```

For ElevationTypes not found in the PDF:

```
ℹ️  2 elevation types in your project were not found in this PDF:
    NL4, F1 — these will remain without images.
```

**Save handler:**

```typescript
const handleSave = async () => {
  setStage('saving');
  const itemsToSave = matched
    .filter(m => !skipped.has(m.elevationTypeId))
    .map(m => ({
      elevationTypeId: m.elevationTypeId,
      elevationTypeCode: m.elevationTypeCode,
      description: editedDescriptions[m.elevationTypeId] ?? m.description,
      croppedImageBase64: m.croppedImageBase64,
      kind: 'door' as const,   // TODO: detect from ElevationType.kind if available
    }));

  const updates = await saveElevationEnrichments(itemsToSave, projectId);
  onSave(updates);   // parent merges into project.elevationTypes
};
```

---

### Step 7 — Toolbar Button + ProjectView Wiring

#### `components/doorSchedule/DoorScheduleManager.tsx`

Add one optional prop + one button:

```tsx
onExtractElevations?: () => void;

// In JSX — next to existing Layers button:
{onExtractElevations && (
  <Tooltip content={
    elevationTypes.length === 0
      ? 'Run the door schedule pipeline first to detect elevation types'
      : 'Extract elevation images from PDF'
  }>
    <button
      onClick={elevationTypes.length > 0 ? onExtractElevations : undefined}
      disabled={elevationTypes.length === 0}
      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary-text)] hover:bg-[var(--primary-bg-hover)] border border-[var(--primary-border)] rounded-lg transition-colors bg-[var(--bg)] disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <FileSearch className="w-3.5 h-3.5" />
    </button>
  </Tooltip>
)}
```

#### `views/ProjectView.tsx`

```tsx
const [isElevationExtractorOpen, setIsElevationExtractorOpen] = useState(false);

// In DoorScheduleManager props:
onExtractElevations={() => setIsElevationExtractorOpen(true)}

// Alongside the existing ElevationManager render:
{isElevationExtractorOpen && (
  <ElevationExtractorPage
    projectId={project.id}
    existingElevationTypes={project.elevationTypes || []}
    onSave={(updates) => {
      // Merge imageUrl + description into the matching ElevationType records
      const updated = (project.elevationTypes || []).map(et => {
        const u = updates.find(u => u.id === et.id);
        return u ? { ...et, imageUrl: u.imageUrl, imagePath: u.imagePath, description: u.description } : et;
      });
      handleElevationTypesUpdate(updated);   // existing handler
      setIsElevationExtractorOpen(false);
    }}
    onClose={() => setIsElevationExtractorOpen(false)}
  />
)}
```

---

## Implementation Order

```
1. types.ts
   → Add DetectedElevationDrawing, ElevationPDFAnalysisResult

2. constants/elevationExtraction.ts
   → New file

3. utils/pdfParser.ts
   → Add renderPDFPagesAsImages()

4. app/api/ai/generate/route.ts
   → Add imageBase64 field + conditional vision message format

5. services/aiProviderService.ts
   → Add imageBase64 to generateAIContent() options

6. services/elevationExtractorService.ts
   → New file: scanPageForElevations, cropDrawingFromPage,
     normalizeTypeCode, analyzeElevationPDF, saveElevationEnrichments

7. components/elevation/ElevationExtractorPage.tsx
   → New full-screen page component

8. components/doorSchedule/DoorScheduleManager.tsx
   → Add onExtractElevations prop + FileSearch button (disabled when no types exist)

9. views/ProjectView.tsx
   → Add state + render ElevationExtractorPage + merge handler
```

---

## What the AI Extracts vs What Already Exists

| Data | Source | Status after pipeline |
|---|---|---|
| Door → ElevationType assignment | Excel (pipeline) | ✅ Already done |
| ElevationType code (e.g. "TYPE A1") | Excel (pipeline) | ✅ Already in DB |
| ElevationType image | **This feature — PDF** | ❌ Missing — we fill it |
| ElevationType description (e.g. "SINGLE HOLLOW METAL DOOR") | **This feature — PDF** | ❌ Missing — we fill it |

After this feature runs, `ElevationType` records are complete:
`{ id, code, name, kind, imageUrl, imagePath, description }` — and all doors that reference that type automatically get the image via their `elevationTypeId`.

---

## Edge Cases

| Case | Handling |
|---|---|
| Type code in PDF doesn't exist in DB | Shown as "unmatched" in review — user can skip |
| ElevationType exists in DB but not in PDF | Listed as "not found in PDF" info note — no action needed |
| Description text not present below drawing | AI returns `""` — description field left empty |
| Same type code appears on multiple pages | Both crops shown in grid; user picks which to keep (or both saved — last write wins) |
| ElevationType already has an imageUrl | On save, existing image is replaced — warn user before overwriting |
| User closes page before Save | Zero uploads, zero DB changes — client state is discarded |
| Supabase upload fails for one item | That card shows error; others still save |
| PDF > 15 MB | Rejected at file input |

---

## Testing Checklist

- [ ] Run pipeline on `TAKEOFF - CITY OF VANCOUVER.xlsx` → verify ElevationType records exist with codes A1, B1, B2, C1 but no images
- [ ] Click Extract Elevations button → extractor page opens
- [ ] Upload `ELEVATION - city of Vancouver.pdf` → progress runs through all stages
- [ ] Review grid shows TYPE A1 with cropped image and "SINGLE HOLLOW METAL DOOR" description
- [ ] All 4 types (A1, B1, B2, C1) are matched
- [ ] Click Save → images appear in Supabase `door-elevations` bucket
- [ ] Open Manage Elevation Types modal → TYPE A1 now shows its image and description
- [ ] Open a door assigned to TYPE A1 → elevation image visible in the door schedule
- [ ] Run same PDF again → page warns that types already have images (overwrite confirmation)
- [ ] Upload Galen PDF after Galen pipeline → DG2, AG2, NL4 matched and enriched correctly
- [ ] Cancel before Save → no Supabase uploads, DB unchanged
- [ ] Upload non-PDF → rejected with error
- [ ] Upload PDF > 15 MB → rejected with error
