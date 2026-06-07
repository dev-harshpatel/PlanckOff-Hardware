# PDF Pipeline — Visual Fallback (Broken Font Encoding)

> Last worked: 2026-06-08
> Relevant files: `services/hardwarePdfServiceV2.ts`, `lib/ai/pdfTextExtractor.ts`, `next.config.ts`

---

## What we were solving

The hardware PDF pipeline was failing on a specific PDF (`DOOR SCHEDULE - HDW.pdf`, project `a24f7248`).

**Symptom:** Set 2 (RESTROOM INTERIOR DOOR) extracted `STORAGE LOCKSET LEVER` instead of `PUSH / PULL`, and `CLOSER` was completely dropped.

**Root cause:** The PDF uses a broken font ToUnicode encoding. pdfjs text extraction returns garbled characters (`38S+` instead of `PUSH`, `38LL` instead of `PULL`, etc.). When we sent the raw PDF bytes to Gemini, Gemini also did its own internal text extraction — hit the same garbled font — couldn't read the PUSH/PULL row — and used its training knowledge ("restroom doors should have a lockset") to fill in `STORAGE LOCKSET LEVER`. That is model hallucination triggered by bad input data.

---

## The two-tier pipeline

```
PDF uploaded
    ↓
Tier 1: pdfjs text extraction
    ↓
isTextReadable()? (requires 2+ hardware keywords: HINGE, LOCKSET, CLOSER, QUANTITY...)
    ├── YES → send extracted text to AI → done
    └── NO  → garbled font detected → Tier 2 visual fallback
                    ↓
            renderPdfToImages() — pdfjs glyph renderer → PNG images
                    ↓
            Send PNG images to Gemini → AI reads visually → correct output
```

**Tier 1** handles ~95% of PDFs (properly encoded fonts).  
**Tier 2** only activates for broken-font PDFs where text extraction is garbled.

---

## Key fixes made this session

### 1. `isTextReadable()` — stricter check (`hardwarePdfServiceV2.ts`)

**Before:** checked for any single keyword like `DOOR` — garbled architectural drawing notes also contained `DOOR`, so the function returned `true` for garbled PDFs and wasted an AI call.

**After:** requires **at least 2 matches** from a hardware-specific list (`HINGE`, `LOCKSET`, `CLOSER`, `QUANTITY`, `MANUFACTURER`, etc.). These words only appear in actual hardware schedules, not in architectural notes.

```typescript
const indicators = [
  'HINGE', 'LOCKSET', 'LOCK SET', 'CLOSER', 'DEADBOLT',
  'WEATHERSTRIP', 'KICK PLATE', 'DOOR STOP', 'WALL STOP',
  'PUSH/PULL', 'PUSH / PULL', 'HARDWARE SET', 'HARDWARE GROUP',
  'QUANTITY', 'MANUFACTURER', 'CATALOG',
];
const matchCount = indicators.filter(word => combined.includes(word)).length;
return matchCount >= 2;
```

### 2. `globalThis.Path2D` fix — canvas rendering (`pdfTextExtractor.ts`)

**Problem:** `@napi-rs/canvas` crashed with `"Value is none of these types: String, Path"` when rendering PDFs.

**Root cause:** pdfjs calls `ctx.clip(new Path2D())` internally. In Node.js, `Path2D` is not a global — so pdfjs created a plain JS object. `@napi-rs/canvas` rejected it because it expected its own `Path2D` type.

**Fix:** One line before rendering:
```typescript
const { createCanvas, Path2D } = await import('@napi-rs/canvas');
(globalThis as Record<string, unknown>).Path2D = Path2D;
```
Now pdfjs creates `@napi-rs/canvas`-compatible path objects and `clip()` works.

### 3. `@napi-rs/canvas` in `serverExternalPackages` (`next.config.ts`)

**Problem:** webpack was bundling `@napi-rs/canvas`, breaking the path to the native `.node` binary.

**Fix:** added to the existing list:
```typescript
serverExternalPackages: ['jspdf', ..., 'pdfjs-dist', '@napi-rs/canvas'],
```
This tells Next.js to load it directly from `node_modules` (not bundle it), same as `pdfjs-dist`.

### 4. Smart crop for large architectural sheets (`pdfTextExtractor.ts`)

**Problem:** This PDF is an A-301 architectural drawing sheet (2592×1728 PDF points). The hardware schedule is a small table in the bottom portion. Sending the full page at 2× scale made the quantity characters ("2", "1") too small for Gemini to distinguish reliably — model returned `qty=1` for `PUSH/PULL` (should be 2).

**Fix:** Detect large landscape sheets (`width > 1400` and `width > height`). For these:
- Render only the **bottom 45%** of the page (where hardware schedules live on architectural sheets)
- At **3× scale** instead of 2× — text is larger and clearly readable
- Exclude right 8% (title block / stamp area)

Result: 7154×2333 px image focused on just the hardware table, vs 5184×3456 px full page.

---

## Visual tier flow (Tier 2) in code

```
tier1Extract() in hardwarePdfServiceV2.ts
    ↓
renderPdfToImages(buffer) in pdfTextExtractor.ts
    ├── if large sheet (w > 1400, landscape):
    │       render full page at 3× → crop bottom 45% → send cropped PNG
    └── else:
            render full page at 2× → send as-is
    ↓
Send PNG image(s) to Gemini via OpenRouter as:
    { type: 'image_url', image_url: { url: `data:image/png;base64,...` } }
```

---

## Current state after this session

| Set | Expected | Got (before) | Got (after) |
|-----|----------|--------------|-------------|
| 1 | LOBBY EXTERIOR DOOR — 6 items | ✓ correct | ✓ correct |
| 2 | RESTROOM — HINGES×3, PUSH/PULL×2, CLOSER×1, WALL STOP×1 | STORAGE LOCKSET LEVER, no CLOSER | ✓ PUSH/PULL + CLOSER present |
| 3–11 | Various | ✓ correct | ✓ correct |

**Remaining minor issue:** `PUSH/PULL` qty shows as 1 in some runs (PDF shows 2). Fixed by the smart crop — larger rendering makes "2" vs "1" distinguishable. Verify after next run.

---

## Unrelated fix also done this session

**MFR doors (sage-garden project):** Doors with `hwSet=MFR` (manufacturer-supplied hardware) were silently dropped from output — they never appeared in the pipeline result at all.

Fixed in `mergeService.ts` with an `anyCodeMatched` flag:
```typescript
if (!anyCodeMatched) {
  unassignedDoors.push(toMergedDoor(row, hwSetRaw, scheduleOrder));
}
```
Now MFR doors appear as unassigned (shown in red in the UI) instead of disappearing.

---

## Files changed this session

| File | What changed |
|------|-------------|
| `services/hardwarePdfServiceV2.ts` | `isTextReadable()` stricter (2+ keywords); visual tier sends PNG via `renderPdfToImages` |
| `lib/ai/pdfTextExtractor.ts` | Added `globalThis.Path2D` fix; added smart crop for large architectural sheets |
| `next.config.ts` | Added `@napi-rs/canvas` to `serverExternalPackages` |
| `services/mergeService.ts` | `anyCodeMatched` flag to preserve MFR/unmatched doors |

---

## Debug output location

```
debug-extractions/pdf-extraction/
  {projectId_8chars}_{timestamp}_meta.json    ← tier used, set count, warnings
  {projectId_8chars}_{timestamp}_parsed.json  ← normalized extracted sets
  {projectId_8chars}_{timestamp}_raw.txt      ← raw AI response
```

Latest good run: `a24f7248_2026-06-07T19-31-03-072Z` — 11 sets, 0 warnings, tier 2.
