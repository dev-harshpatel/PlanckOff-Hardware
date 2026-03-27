# /pdf-pipeline — PDF Extraction Pipeline Architecture

You are executing the `/pdf-pipeline` command. This is the focused context for working on Phase 2 of the project — the AI PDF extraction pipeline architecture overhaul.

---

## What Already Exists (Do Not Rebuild These)

| Component | File | Status |
|---|---|---|
| PDF text extraction with page batching | `utils/pdfParser.ts` | ✅ Works — `extractTextGenerator` yields page batches |
| Door extraction from text | `services/geminiService.ts:572` | ✅ Works — `extractDoorsFromChunk` |
| Hardware set extraction from text | `services/geminiService.ts:383` | ✅ Works — `extractHardwareSetsFromChunk` |
| Structured JSON schemas for both types | `services/geminiService.ts:111–194` | ✅ Works |
| JSON repair loop (100 iterations) | `services/geminiService.ts:34` | ⚠️ Overbuilt — reduce to 10 |
| Chunked pipeline wiring | `services/fileUploadService.ts:206–233` | ✅ Works — but has CONCURRENCY=1 |
| Upload Web Worker | `workers/upload.worker.ts` | ✅ Exists — single worker |
| Gemini + OpenRouter abstraction | `services/aiProviderService.ts` | ✅ Exists — keys exposed client-side |
| Vision analysis (images) | `services/geminiService.ts:260` | ✅ `analyzeImageWithAI` exists |

---

## The Core Problems to Fix

### Problem 1: CONCURRENCY = 1 (Most Critical — Fix This First)

**Location:** `services/geminiService.ts:462` and `:659`

```typescript
// CURRENT — sequential, deadly for 200+ page PDFs
const CONCURRENCY = 1
for (let i = 0; i < totalChunks; i += CONCURRENCY) { ... }
```

**Target:** `AsyncQueue` with configurable concurrency (default 3, max depends on API tier).

```typescript
// TARGET ARCHITECTURE
class AsyncQueue {
  constructor(private concurrency: number) {}
  async add<T>(task: () => Promise<T>): Promise<T> { ... }
  async drain(): Promise<void> { ... }
}

const queue = new AsyncQueue(3)
const results = await Promise.all(
  chunks.map(chunk => queue.add(() => extractChunk(chunk)))
)
```

**Note:** This requires Phase 1.2 (API proxy) to be complete first. Client-side parallel AI calls will hit rate limits immediately. Server-to-server calls get 10–100x higher limits.

---

### Problem 2: Double Chunking Conflict

**Locations:**
- `services/fileUploadService.ts:210` — batches 10 pages per chunk using the generator
- `services/geminiService.ts:447` — splits text by `\n\n` and re-chunks to size 10

The file service already chunks by page boundary. The gemini service then re-chunks. This creates unpredictable boundaries.

**Fix:** `extractDoorsFromText` and `extractHardwareSetsFromText` should not chunk internally. They should call `extractDoorsFromChunk` directly with the text they receive.

---

### Problem 3: No Page Relevance Triage

Every page of the PDF (including cover pages, architectural drawings, details, specifications) gets sent to AI. For a 200-page project PDF, ~60% of pages contain no door schedule or hardware data.

**Target function:**
```typescript
type PageRole = 'door-schedule' | 'hardware-set' | 'irrelevant'

function classifyPage(text: string): PageRole {
  const doorKeywords = /door tag|door number|door mark|width|height|frame|hinge|hardwarePrep/i
  const hardwareKeywords = /hw-\d|set \d+|hardware set|hinge|lockset|closer|exit device|division 0?8/i

  if (doorKeywords.test(text) && /\b\d{2,4}\b/.test(text)) return 'door-schedule'
  if (hardwareKeywords.test(text)) return 'hardware-set'
  return 'irrelevant'
}
```

---

### Problem 4: Chunk Boundary Data Loss

When a hardware set spans pages 10–11, the chunk for pages 1–10 gets HW-1 partially, and the chunk for pages 11–20 gets it partially. Both chunks produce incomplete results.

**Fix:** Add N-line overlap at chunk boundaries. Each chunk includes the last 5 lines of the previous chunk. Then run a deduplication pass after merging: same doorTag or same set name from adjacent chunks → merge, don't duplicate.

---

### Problem 5: No Checkpoint/Resume

A 200-page PDF = 20 AI calls. If call #18 fails (network drop, rate limit), the user loses all progress.

**Target:** Store completed chunk results in IndexedDB keyed by `(fileHash, chunkIndex)`. On retry, skip chunks with stored results.

```typescript
const fileHash = await sha256(file)
const key = `pdf_chunk_${fileHash}_${chunkIndex}`
const cached = await idb.get(key)
if (cached) return cached // Skip AI call
```

---

### Problem 6: Vision Fallback Missing for Scanned PDFs

When `pdfjs-dist` extracts text and the page is a scanned image, text.length is near 0. The current code sends this empty text to AI anyway.

**Fix:**
```typescript
// In pdfParser.ts — after extracting text from a page
if (text.trim().length < 50) {
  // Render page to canvas → base64 PNG → analyzeImageWithAI
}
```

---

## Implementation Order

Do NOT implement all of this at once. Follow this sequence:

1. **Phase 1.2 must come first** — Move AI calls to Next.js API route before adding concurrency.
2. Fix double-chunking (Problem 2) — Quick win, no dependencies.
3. Add page relevance triage (Problem 3) — Reduces AI calls immediately.
4. Add `AsyncQueue` concurrency (Problem 1) — Requires API proxy.
5. Add chunk overlap + deduplication (Problem 4).
6. Add checkpoint/resume (Problem 5).
7. Add vision fallback (Problem 6) — Last, highest cost in tokens.

---

## Architecture Diagram (Target State)

```
PDF Upload
    │
    ▼
pdfParser.extractTextGenerator() — yields {text, pageRange} per batch
    │
    ▼
classifyPage() — filters irrelevant pages, groups by role
    │
    ├─► door-schedule pages
    │       │
    │       ▼
    │   AsyncQueue(concurrency=3)
    │       │
    │       ├── extractDoorsFromChunk(chunk1) ─→ /api/ai/generate
    │       ├── extractDoorsFromChunk(chunk2) ─→ /api/ai/generate
    │       └── extractDoorsFromChunk(chunk3) ─→ /api/ai/generate
    │
    └─► hardware-set pages
            │
            ▼
        AsyncQueue(concurrency=3)
            │
            └── extractHardwareSetsFromChunk(chunk) ─→ /api/ai/generate
    │
    ▼
Overlap stitching + deduplication
    │
    ▼
validateDoors() / validateHardwareSets()
    │
    ▼
onData() streaming callback → UI updates in real time
```

---

## Files You Will Touch

| File | Action |
|---|---|
| `utils/pdfParser.ts` | Add vision fallback for empty-text pages |
| `services/geminiService.ts` | Remove internal re-chunking; reduce JSON repair loop; add AsyncQueue |
| `services/fileUploadService.ts` | Wire triage and queue; add overlap |
| `workers/upload.worker.ts` | Expand to worker pool (2–3 workers) |
| `utils/pdfTriage.ts` | NEW — `classifyPage()` function |
| `utils/pdfCheckpoint.ts` | NEW — IndexedDB checkpoint/resume |
| `app/api/ai/generate/route.ts` | NEW — server-side AI proxy (Phase 1.2 prereq) |

---

## Standards to Enforce While Working Here

- Chunk-level functions (`extractDoorsFromChunk`) are pure — same text in = same result out
- All AI calls go through the API route (`/api/ai/generate`) — never direct
- Progress events must be emitted at each chunk completion (not just start/end)
- Every function has explicit TypeScript types — no `any`
- The `AsyncQueue` must support graceful cancellation (AbortSignal)
