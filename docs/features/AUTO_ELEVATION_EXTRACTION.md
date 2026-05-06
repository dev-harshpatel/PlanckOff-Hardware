# Auto Elevation Extraction from PDF
## Feature Implementation Guide

> **Goal:** When a user uploads an elevation PDF, automatically detect individual elevation drawings, read their door mark labels, crop each elevation as an image, and assign them to the correct doors — without any manual work.

---

## Prerequisites

Before starting, make sure you understand these existing files:

| File | Why You Need It |
|---|---|
| `utils/pdfParser.ts` | Already uses `pdfjs-dist` — you will extend it to render pages as images |
| `services/geminiService.ts` | Has `analyzeImageWithAI()` — you will add a new elevation-specific vision function here |
| `services/elevationService.ts` | Has `compressElevationImage()` and `uploadElevationImage()` — reuse as-is |
| `services/fileUploadService.ts` | Entry point for file uploads — you will add a new route here |
| `types.ts` | `ElevationType` and `Door` types — you will extend `ElevationType` slightly |
| `utils/elevationUtils.ts` | Has `resolveElevationTypes()` — used for matching after extraction |

---

## Step 1 — Extend `pdfParser.ts` to Render Pages as Images

Currently `pdfParser.ts` only extracts text. `pdfjs-dist` can also render each page onto a canvas and export it as a base64 image. You need to add this capability.

**Add a new exported function** `renderPDFPagesAsImages()` in `utils/pdfParser.ts`:

```typescript
// What it should do:
// 1. Load the PDF using pdfjs-dist (same lazy import pattern already in the file)
// 2. For each page (or a given range), render it onto an OffscreenCanvas at a scale of 2.0
//    (scale 2.0 = 2x resolution, important for LLM to read small door mark labels clearly)
// 3. Export each canvas as a base64 JPEG string (quality 0.92)
// 4. Yield each result as { pageNumber, totalPages, imageBase64, progress }
// 5. Call page.cleanup() after each render to manage memory

// Signature:
export async function* renderPDFPagesAsImages(
  file: File,
  options?: { scale?: number; pageRange?: { start: number; end: number } }
): AsyncGenerator<PDFPageImageResult>

// New type to add:
interface PDFPageImageResult {
  pageNumber: number;
  totalPages: number;
  imageBase64: string;   // data:image/jpeg;base64,...
  progress: number;      // 0-100
}
```

**Key implementation note:** Use `OffscreenCanvas` for rendering (same pattern as `elevationService.ts` uses for compression). Fall back to `document.createElement('canvas')` for older browsers.

---

## Step 2 — Add Elevation Vision Function in `geminiService.ts`

Add a new function `extractElevationsFromPageImage()`. This is where the LLM does the heavy lifting — it looks at one rendered PDF page and finds all elevation drawings on it.

**Function signature:**
```typescript
export async function extractElevationsFromPageImage(
  pageImageBase64: string,
  pageNumber: number
): Promise<ExtractedElevationResult[]>
```

**New type to add in `types.ts`:**
```typescript
interface ExtractedElevationResult {
  doorMark: string;           // e.g. "101A", "204", "B-12"
  elevationKind: 'door' | 'frame' | 'unknown';
  boundingBox: {              // normalized 0-1 coordinates on the page
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;         // 0-1, LLM confidence in the door mark read
  rawLabel: string;           // exact text the LLM read from the drawing
}
```

**Prompt strategy for Gemini Vision:**

The prompt should instruct the model to:
1. Scan the page for elevation drawings (rectangular architectural drawings showing door/frame profiles)
2. For each drawing found, read the door mark label (usually below or beside the drawing, often formatted like "DOOR ELEVATION - 101A" or just "101A")
3. Determine if it is a door elevation or frame elevation
4. Return the bounding box of the drawing as normalized coordinates (0 to 1)
5. Return a confidence score — if the label is unclear or ambiguous, score below 0.7

Use the same JSON schema validation pattern already in `geminiService.ts` (Type.OBJECT, Type.ARRAY from Google GenAI SDK).

**Important:** Route this through `generateAIContent()` from `aiProviderService.ts` — never call Gemini directly. Use `gemini-2.5-flash` as the default model (it has vision support).

---

## Step 3 — Create `services/elevationExtractorService.ts`

This is the orchestration layer. It ties Steps 1 and 2 together and handles cropping, compression, and matching.

**Functions to implement:**

### 3a. `cropElevationFromPage()`
```typescript
async function cropElevationFromPage(
  pageImageBase64: string,
  boundingBox: { x: number; y: number; width: number; height: number }
): Promise<string>  // returns cropped base64 image
```
- Create an `OffscreenCanvas` at the page image dimensions
- Draw the full page image onto it
- Use `ctx.getImageData()` with bounding box coordinates to crop the elevation area
- Add a small padding (e.g. 5% of bounding box size) so the crop isn't too tight
- Export as WebP (same format as `elevationService.ts`)

### 3b. `matchElevationToDoor()`
```typescript
function matchElevationToDoor(
  extractedDoorMark: string,
  doors: Door[]
): { door: Door; confidence: number } | null
```
- First try exact match: `door.doorTag === extractedDoorMark`
- Then try normalized match: strip spaces, dashes, leading zeros and compare
- Then try partial match: extracted mark is a substring of doorTag or vice versa
- Return `null` if no match above 0.6 confidence

### 3c. `processElevationPDF()` — Main orchestrator
```typescript
export async function processElevationPDF(
  file: File,
  projectId: string,
  doors: Door[],
  onProgress?: (stage: string, percent: number) => void
): Promise<ElevationExtractionReport>
```

**New type:**
```typescript
interface ElevationExtractionReport {
  matched: Array<{
    doorId: string;
    doorMark: string;
    elevationTypeId: string;   // newly created ElevationType id
    imageUrl: string;
    confidence: number;
  }>;
  unmatched: Array<{
    doorMark: string;           // LLM found this but no door matched
    imageBase64: string;
    pageNumber: number;
  }>;
  lowConfidence: Array<{
    doorMark: string;
    confidence: number;
    pageNumber: number;
  }>;
  totalPagesProcessed: number;
  totalElevationsFound: number;
}
```

**Flow inside `processElevationPDF()`:**
1. Call `renderPDFPagesAsImages()` — get each page as base64 image
2. For each page, call `extractElevationsFromPageImage()` — get list of elevations found
3. For each found elevation:
   - Call `cropElevationFromPage()` to get the cropped image
   - Call `compressElevationImage()` from `elevationService.ts` to compress it
   - Call `matchElevationToDoor()` to find the target door
   - If matched with confidence ≥ 0.7:
     - Call `uploadElevationImage()` from `elevationService.ts` to store in Supabase
     - Create a new `ElevationType` record with the door mark as code/name
     - Link the `ElevationType` to the matched door via `elevationTypeId`
   - If not matched or low confidence: add to `unmatched` / `lowConfidence` lists
4. Return the full `ElevationExtractionReport`

---

## Step 4 — Add Route in `services/fileUploadService.ts`

Add a new exported function `processElevationPDFFile()` following the same pattern as the existing `processDoorScheduleFile()`:

```typescript
export async function processElevationPDFFile(
  file: File,
  projectId: string,
  doors: Door[],
  onProgress?: (stage: string, percent: number) => void
): Promise<ValidationReport<ElevationExtractionReport>>
```

- Validate file type is PDF and size ≤ 10MB (same guards as existing functions)
- Call `processElevationPDF()` from `elevationExtractorService.ts`
- Wrap result in `ValidationReport` structure with warnings for unmatched/low-confidence elevations
- Each unmatched elevation should produce a warning like: `"Elevation found for door mark 'XYZ' but no matching door was found in the project"`

---

## Step 5 — UI: Add Elevation PDF Upload to `ElevationManager.tsx`

The existing `components/ElevationManager.tsx` is where users manually manage elevation types. Add a new section at the top:

**New UI section: "Auto-Extract from PDF"**

```
[ Upload Elevation PDF ]   ← file input, accepts PDF only

When file is selected:
  → Show progress bar with stage labels:
      "Rendering pages..."       (Step 1)
      "Detecting elevations..."  (Step 2 - per page)
      "Uploading images..."      (Step 3)
      "Matching to doors..."     (Step 3c)

When complete:
  → Show ElevationExtractionSummary component (see below)
```

**New component: `ElevationExtractionSummary`**

This is a results modal/panel shown after extraction completes:

```
✅ 24 elevations matched and assigned automatically

⚠️  3 elevations could not be matched:
    - Door mark "X-99" (Page 4) — no door found
    - Door mark "204B" (Page 7) — no door found
    - [unclear label] (Page 12) — confidence too low

For unmatched ones, show a small preview of the cropped image
and a dropdown to manually assign it to a door.
```

After the user resolves unmatched ones (or dismisses), save everything.

---

## Step 6 — Handle the Manual Fallback for Unmatched Elevations

For elevations that couldn't be auto-matched, the user should be able to assign them manually from the `ElevationExtractionSummary` UI.

- Show the cropped elevation image preview
- Show a searchable door selector dropdown (search by door tag)
- On selection, call the same `uploadElevationImage()` + create `ElevationType` + link to door flow
- This re-uses all the same functions from Step 3 — no new logic needed

---

## Step 7 — Error Handling & Edge Cases

Handle these specific cases explicitly:

| Case | How to Handle |
|---|---|
| PDF has no detectable elevation drawings | Return report with `totalElevationsFound: 0`, show info message to user |
| LLM returns a door mark that partially matches multiple doors | Pick highest confidence match, add others to `lowConfidence` list |
| Page renders as blank/corrupt image | Skip page, add warning to report |
| Supabase upload fails for one elevation | Do not fail the whole batch — mark that elevation as unmatched and continue |
| PDF is > 10MB | Reject at `fileUploadService.ts` entry point with clear error message |
| PDF is text-only (no drawings) | LLM will return empty array for each page — show info message |
| Elevation drawing spans two pages | Out of scope for v1 — add to `unmatched` with note |

---

## Step 8 — Constants to Add in `constants/`

Add a new file `constants/elevationExtraction.ts`:

```typescript
export const ELEVATION_EXTRACTION = {
  PDF_RENDER_SCALE: 2.0,
  MIN_MATCH_CONFIDENCE: 0.7,
  MIN_LLM_READ_CONFIDENCE: 0.6,
  CROP_PADDING_PERCENT: 0.05,
  MAX_FILE_SIZE_MB: 10,
  SUPPORTED_FILE_TYPES: ['application/pdf'],
} as const;
```

---

## Implementation Order

Follow this order to avoid blockers:

```
1. types.ts           → Add ExtractedElevationResult, ElevationExtractionReport types
2. constants/         → Add elevationExtraction.ts constants
3. pdfParser.ts       → Add renderPDFPagesAsImages() function
4. geminiService.ts   → Add extractElevationsFromPageImage() function
5. elevationExtractorService.ts  → Create full service (Steps 3a, 3b, 3c)
6. fileUploadService.ts          → Add processElevationPDFFile() route
7. ElevationManager.tsx          → Add upload UI section
8. ElevationExtractionSummary    → Create summary/results component
```

---

## Testing Checklist

Before marking this feature complete, verify:

- [ ] A clean elevation PDF with clear labels auto-assigns all elevations correctly
- [ ] Low-quality / scanned PDF shows low-confidence warnings instead of wrong assignments
- [ ] Unmatched elevations appear in the summary and can be manually assigned
- [ ] Progress bar updates correctly through all stages
- [ ] Uploading the same PDF twice does not create duplicate `ElevationType` records
- [ ] Files over 10MB are rejected with a clear error
- [ ] Non-PDF files are rejected at the upload input
- [ ] Supabase Storage bucket `door-elevations` has the uploaded images after completion
- [ ] After extraction, doors show their assigned elevation images correctly in the door schedule view

---

## Notes for Future Improvements (Post v1)

- **Batch page processing:** Currently sequential (CONCURRENCY=1). For large elevation PDFs (50+ pages), process pages in parallel batches of 3-5.
- **Caching LLM results per page:** If the same PDF is uploaded again, skip LLM calls for pages already processed (use a hash of the page image as the cache key).
- **Elevation spanning two pages:** Detect when a drawing is cut off at a page boundary and stitch the two crops together.
- **Frame vs Door elevation disambiguation:** The LLM prompt can be improved to more reliably distinguish between door elevation and frame elevation drawings when both appear on the same page.
