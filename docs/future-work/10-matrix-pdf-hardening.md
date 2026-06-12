# Matrix PDF Processing — Hardening Plan

> Status: planned. Wait for real sample PDFs before implementing — every item below
> should be driven by an actual failing document, not speculation.
>
> Last updated: 2026-06-12

## Background

Matrix-format hardware schedules (Format F) were added on 2026-06-12: door numbers as
column headers, hardware item names as row labels, checkboxes marking which items belong
to which door's hardware set (sample: `docs/material/New-Type-Matrix-Format-PDF.pdf`).

The current implementation is a layered pipeline (see `services/hardwarePdf/matrixExtraction.ts`):

1. `renderEmbeddedImageCloseups` (`lib/ai/pdfTextExtractor.ts`) — finds large **embedded
   raster images** on sheets and renders those regions at high zoom.
2. `tryMatrixExtraction` — dedicated AI transcription call (`MATRIX_MODEL` =
   gemini-2.5-pro), row-wise schema.
3. `analyzeCheckboxGrid` (`lib/ai/matrixGridAnalyzer.ts`) — **deterministic pixel
   analysis**: grid lines via projection profiles, cells classified by gray-fill
   fraction. Overrides the AI's checkbox readings when counts align. This is the
   load-bearing accuracy layer — both Flash and Pro misread dense grids on their own.
4. `rereadValueRowsFromStrips` — LOCKSET-style value rows re-read from a cropped
   header+row strip (full-grid value transcription shifts columns between runs).

Every layer fails soft: any mismatch keeps the AI reading and logs a warning; a
non-matrix document falls through to the normal visual extraction unchanged.

Test harness: `npx tsx scripts/test-hardware-pdf-extraction.ts [path/to.pdf]`
(needs `OPENROUTER_API_KEY` in `.env.local`; `NODE_ENV=development` writes debug files
to `debug-extractions/pdf-extraction/`).

## Known gaps and hardening items

### Gap 1 — Matrix drawn as vector graphics (not an embedded image)

> **PARTIALLY RESOLVED 2026-06-12** — the per-door variant of this gap is now handled
> by Tier 0: `extractDoorScheduleGrid` (`lib/ai/doorScheduleGrid.ts`), a fully
> deterministic extractor (no AI calls) for vector-drawn per-door schedules where
> doors are ROWS and hardware items are indicator COLUMNS (text "YES"/"−" cells or
> graphical checkbox cells). Validated on `New-Type-Matrix-Format-PDF-2.pdf`
> (105 sets, two side-by-side tables, rotated page, YES/− text marks) and
> `New-Type-Matrix-Format-PDF-3.pdf` (98 sets, black-filled checkbox marks,
> hyphenated door numbers, lock-function column in an unruled stretch).
> Structure comes from the text layer (`extractPositionedText`), column boundaries
> from ruling-line projection, marks from cell-pixel dark fractions.
> STILL OPEN: a vector-drawn Format F matrix (doors as COLUMNS, items as rows) —
> that orientation is not covered by Tier 0 and would still fall through to the
> visual tier without close-ups.

**Symptom:** the matrix is drawn with PDF line/text operators directly on the sheet.
`renderEmbeddedImageCloseups` finds no embedded raster image → no close-ups → the
matrix path never triggers → full-sheet visual extraction misreads checkboxes.

**Detection:** logs show no `[hardwarePdf:visual] Added N high-res close-up(s)` line for
a sheet that visibly contains a matrix.

**Fix sketch:**
- Detect matrix regions from the page itself instead of relying on image XObjects.
  Option A: run `analyzeCheckboxGrid` on the full-page render — the projection-profile
  grid detection works on any rendered pixels, not just embedded images. If a grid with
  ≥ `MIN_DOOR_COLUMNS` uniform columns is found, compute its bounding box from the
  detected line positions and re-render just that region at high zoom as a synthetic
  "close-up".
- Option B (cheaper trigger): vector matrices have extractable TEXT (door numbers, row
  labels appear in pdfjs text extraction, unlike the raster case). Add a text-side
  detector — a line containing many short door-number-like tokens (`/^\d{3}[a-z]?$/`)
  following a "DOOR NUMBER" label — and force the visual+grid path for that page.
- Note: checked cells in vector form may extract as text glyphs (✓/X) — a vector matrix
  might even be readable *from text alone*. Inspect the extracted text of the real
  sample first.

### Gap 2 — Scanned page (image covers the whole page)

**Symptom:** a scan of a matrix schedule is one embedded image covering ~100% of the
page. `CLOSEUP_MAX_PAGE_FRACTION = 0.60` deliberately skips it (full-page scans are
normally covered by the page render), so no close-up, no matrix path.

**Fix sketch:**
- Don't lift the 0.60 cap blindly (it protects every ordinary scanned document from a
  redundant duplicate image). Instead, when a page is a single full-page image AND
  `analyzeCheckboxGrid` on the page render finds a checkbox grid, treat the grid's
  bounding box as the close-up region (same mechanism as Gap 1 Option A).
- Scans add noise: skew, speckle, uneven illumination. The analyzer's thresholds
  (`H_LINE_MIN_DARK_FRACTION`, gray-fill bands) are calibrated on clean machine-generated
  output. For scans, add a deskew step (estimate rotation from the dominant line angle)
  and consider adaptive thresholds (Otsu per image instead of fixed luminance cutoffs).

### Gap 3 — Checkbox style not gray-filled

**Symptom:** current cell classifier (`classifyCell`) keys on the gray-fill band
(luminance 100–240). A matrix using a plain **X / ✓ mark in a white box** classifies
checked cells as `text` (dark fraction high, gray low) → row types come out wrong →
count mismatch → fail-soft to AI-only reading (unreliable).

**Fix sketch:**
- Extend the classifier with a second checked-signature: `dark fraction > threshold`
  **inside a box outline** with no value-row context. Practical approach: per row,
  compute the cell-state histogram; if a row has cells that are uniformly either
  `none`-ish or `dark-mark`, and the row sits among checkbox rows, treat dark-mark as
  checked.
- Better: make the classifier two-pass. Pass 1 determines per-row cell statistics; pass
  2 picks the per-row discriminator (gray-fill vs dark-mark) from the bimodal split,
  instead of one global rule. Keep the calibration constants per signature.
- Add the real sample's pixels to a small fixture test (crop one row band, assert cell
  states) before changing thresholds — see "Regression safety net" below.

### Gap 4 — Multiple matrices on one sheet / document

**Symptom:** `MATRIX_SCHEMA` transcribes a single matrix (`isMatrix`, one `doorNumbers`
list). Two independent grids (e.g. Level 1 sheet + Level 2 sheet, or two grids side by
side) → only one transcribed, or the AI merges them.

**Fix sketch:**
- Schema change: `matrices: [{ doorNumbers, valueRows, checkboxRows, columnNotes }]`
  with a shared `products` legend. Loop `buildSetsFromMatrix` per matrix and merge sets
  (door numbers should be globally unique across levels; if they collide, suffix or warn).
- Pixel side already runs per close-up; pair each transcribed matrix with the close-up
  whose grid dimensions match (`doorColumnCount` × checkbox-row count) instead of
  "first that reconciles".

### Gap 5 — Multi-column notes attributed to one column only

**Symptom (known, live today):** the vertical note "EXISTING - PROVIDE NEW LOCK SET
ONLY" spans EX211 and EX214 columns, but the transcription sometimes emits a
`columnNotes` entry for only one of them. Items stay correct; only the `notes` field is
incomplete on the second door.

**Fix sketch:**
- Deterministic assist: the grid analyzer already classifies note-column cells as
  `text`/`none` (never `checked`/`unchecked`). Identify "note columns" = door columns
  whose checkbox-row cells are ≥80% `text`/`none`. If the AI supplied a note for one
  note-column and another note-column has no note, re-read just those columns with a
  cropped strip call (rotate the crop 90° so the vertical text reads horizontally), or
  copy the note when the pixel signature of the two columns is near-identical.

### Gap 6 — Grid geometry edge cases

Collected smaller robustness items in `lib/ai/matrixGridAnalyzer.ts`:

- **Dashed/light grid lines** — projection-profile thresholds (`0.4` horizontal /
  `0.25` vertical dark fraction) miss dashed rules. Mitigation: lower threshold +
  require periodicity, or morphological closing along the scan axis before profiling.
- **Variable row heights** (wrapped row labels) — `longestUniformRun` excludes the tall
  row, breaking the run. Mitigation: allow K outlier gaps inside a run if they are
  < 2× median and the run continues beyond.
- **Merged cells inside the grid body** (one check spanning a door pair like 204a+204b)
  — currently reads as checked for whichever cell centers fall inside the merged area;
  verify against a real sample.
- **>3 value rows or interleaved value/checkbox ordering differences** between AI and
  pixel analysis — alignment is by type-order today; if a real document breaks it, match
  rows by label OCR instead (strip-read each row label).

### Gap 7 — Cost/latency guardrails for the matrix path

Current cost when close-ups exist: 1× gemini-2.5-pro transcription (+1× pro call per
value row). Non-matrix documents with embedded images (e.g. `DOOR SCHEDULE - HDW.pdf`)
pay the transcription call only to get `isMatrix=false`.

**Fix sketch:**
- Run `analyzeCheckboxGrid` BEFORE the AI call and skip the transcription entirely when
  no close-up contains a plausible grid (cheap, pure CPU). Today the order is reversed
  (AI first) because the analyzer's grid detection doubles as verification; flipping the
  order keeps verification and saves the wasted pro call on non-matrix documents.
  This is the highest-value, lowest-risk item in this list and needs no new sample PDF.
- Cap close-up count sent to the matrix call (currently all; `CLOSEUP_MAX_PER_PAGE = 3`
  bounds it per page but multi-page documents could accumulate).

## Regression safety net (do this with whichever gap lands first)

There are no automated tests for this pipeline; every change so far was verified by
paid end-to-end runs. Before hardening anything:

1. Commit small PNG fixtures: the matrix close-up plus 2–3 cropped row bands from each
   new sample format.
2. Unit-test `analyzeCheckboxGrid` against the fixtures (pure function, no API key, no
   network): assert door-column count, row count, row types, and exact cell states.
3. Unit-test `buildSetsFromMatrix` + `reconcileMatrixWithGrid` with a canned
   transcription JSON (already deterministic).
4. Keep one recorded transcription response per sample so the assembly logic can be
   tested without OpenRouter calls.

This turns "did the refactor break the matrix path?" from a $0.10 e2e run into a free
`npm test`.

## Decision log

- Pixel verification over prompt engineering: Flash emitted identical sets for every
  door; Pro shifted columns and dropped door 205b. Prompt-only fixes were attempted
  twice and rejected — do not retry them for grid alignment.
- `MATRIX_MODEL` = pro, regular extraction stays on flash: matrix call is rare, accuracy
  of labels/headers there is critical, and the cost delta is bounded.
- Fail-soft everywhere: an aligned-counts check gates every deterministic override, so a
  layout the analyzer cannot parse degrades to the AI reading instead of corrupting it.
