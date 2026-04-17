# PDF Upload Pipeline — Architecture V2
## PlanckOff — Hardware Estimating Platform

**Status:** Phase 1 implemented — Phase 2 (fallback + UI) pending  
**Replaces:** The text-extraction-then-AI approach in `services/hardwarePdfService.ts`  
**Goal:** 100% accuracy on any hardware schedule PDF — text-based, scanned, or mixed layout

> **OpenRouter note:** The original design described using the Gemini Files API (upload → file URI → AI call).
> After confirming the project uses OpenRouter exclusively, this was revised: OpenRouter has no Files API.
> We instead send the raw PDF as a base64 inline data URI directly in the chat message. The model still
> receives and reads the full PDF natively — the transport differs, the result is the same.

---

## 1. Problems with the Current Approach

### Current flow (V1)

```
Browser
  └─ pdfjs-dist (client-side text extraction)
       └─ extractTextGenerator() → yields raw text strings per page
            └─ sends pages[] as JSON → POST /api/projects/[id]/hardware-pdf

Server
  └─ hardwarePdfService.ts
       └─ batchPageTexts() → 10-page batches (sequential)
            └─ generateText() → OpenRouter → gemini-2.5-flash (free-form prompt)
                 └─ parseAIResponse() → regex + JSON.parse
                      └─ mergeBatchResults() → upsert Supabase
```

### Why this fails on real-world PDFs

| Problem | Impact |
|---|---|
| `item.str.join(' ')` flattens all spatial layout | Columns blur together — AI guesses where one item ends and the next starts |
| Text extraction runs in the browser | Large PDFs freeze or crash the tab; scanned PDFs produce empty strings |
| 10 batches × ~5s each, sequential | 100-page PDF = 50–90s, frequently hits the 120s `maxDuration` limit |
| Sets can span batch boundaries | Merge-by-setName is fragile — items at boundaries get duplicated or dropped |
| AI returns free-form text | `parseAIResponse()` silently returns `[]` if the model adds any explanation |
| Prompt hardcodes item categories and finish codes | Fails on PDFs from different consultants who use different terminology |

**Root cause:** We pre-process the PDF into text before the AI sees it. The text loses the table structure. The AI is working with degraded input.

---

## 2. Core Insight

**Gemini 2.5 Flash/Pro natively understands PDFs.**

The raw PDF binary is sent directly to the model. It sees the actual visual layout — table columns, row groupings, indentation, headers — exactly as a human would. No text pre-extraction needed.

Via OpenRouter this is done by base64-encoding the PDF buffer and sending it as an inline `data:application/pdf;base64,...` data URI in the message content. OpenRouter routes this to Gemini's native PDF processor (the `native` engine, charged as tokens).

This eliminates the #1 accuracy problem: the AI sees the real structure instead of flattened text.

---

## 3. New Architecture (V2) — Implemented

```
Browser
  └─ File picker — sends raw PDF binary (no processing, no pdfjs)
       └─ POST /api/projects/[id]/hardware-pdf  (multipart/form-data, field: "file")

Server — app/api/projects/[id]/hardware-pdf/route.ts
  │
  ├─ Step 1: Validate
  │           └─ auth (withAuth middleware)
  │           └─ file must be .pdf, max 20 MB
  │
  ├─ Step 2: Buffer → base64
  │           └─ buffer.toString('base64')
  │           └─ inline data URI: data:application/pdf;base64,{base64}
  │
  ├─ Step 3: Single AI call via OpenRouter
  │           └─ model: google/gemini-2.5-flash
  │           └─ message content: [{ type: 'image_url', image_url: { url: dataUri } }, { type: 'text', text: prompt }]
  │           └─ response_format: { type: 'json_schema', json_schema: { schema: RESPONSE_SCHEMA } }
  │           └─ OpenRouter routes to Gemini native PDF engine (reads real layout)
  │           └─ returns structured JSON — guaranteed by schema enforcement
  │
  ├─ Step 4: Parse + normalize
  │           └─ unwrap { sets: [...] } envelope
  │           └─ normalizeSet() / normalizeItem() — type-safe, no `any`
  │           └─ fallback parser if model ignores schema (returns bare array)
  │
  ├─ Step 5: Debug output (DEV only)
  │           └─ debug-extractions/{projectId}_{timestamp}_raw.txt
  │           └─ debug-extractions/{projectId}_{timestamp}_parsed.json
  │           └─ debug-extractions/{projectId}_{timestamp}_meta.json
  │
  └─ Step 6: Upsert → hardware_pdf_extractions (Supabase)
              └─ return { setCount, itemCount, durationMs, warnings }
```

### What changed vs V1

| V1 | V2 |
|---|---|
| Text extracted client-side with pdfjs (browser) | Raw PDF sent to server — browser does zero processing |
| pdfjs `item.str.join(' ')` flattens table layout | Gemini reads actual PDF layout natively via OpenRouter |
| N sequential AI calls (one per 10-page batch) | One AI call for the entire document |
| Free-form prompt → regex JSON parsing → silent `[]` on failure | `json_schema` response format → structured output guaranteed |
| Fails on scanned/image PDFs | Gemini vision handles text, scanned, and mixed PDFs |
| Sets split across batches — fragile merge-by-name | Single-pass extraction — no boundary problem |
| API keys in client bundle (old `aiProviderService.ts`) | All AI calls server-side only |

---

## 4. Two-Tier Fallback Strategy

**Status: Phase 2 — not yet implemented.**

Not every PDF will work with Tier 1. Some PDFs are malformed, some exceed size limits, and OpenRouter or Gemini may occasionally be unavailable. The system should fall back automatically.

```
POST /api/projects/[id]/hardware-pdf
  │
  ├─ Tier 1: OpenRouter inline base64 (primary) ← IMPLEMENTED
  │   PDF buffer → base64 → single AI call with json_schema response format
  │   Best accuracy — model reads real PDF layout natively
  │   Handles: text PDFs, scanned PDFs, mixed, multi-column tables
  │   Practical limit: ~15 MB (base64 overhead ~33%, OpenRouter body limits)
  │
  └─ Tier 2: Server-side text extraction (Phase 2 — not built yet)
      Trigger: Tier 1 throws, or file > 15 MB, or setCount === 0
      pdfjs-dist Node build → extract text server-side (no browser)
      Position-aware column reconstruction using x/y item coordinates
      Parallel AI batches (not sequential) with json_schema response format
      Merge results across batches by setName
```

Tier 1 covers ~95% of real-world hardware schedule PDFs.  
Tier 2 handles edge cases (very large files, corrupted PDFs, API outage).

---

## 5. Structured Output — No More JSON Parsing

### V1 (fragile)
```ts
// AI returns free-form text, we try to extract JSON from it
function parseAIResponse(raw: string): ExtractedHardwareSet[] {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  // ... 30 lines of regex and JSON.parse inside try/catch
  // silently returns [] on any failure
}
```

### V2 (implemented) — `json_schema` response format via OpenRouter
```ts
// Wrapped in an object (not top-level array) — required by OpenAI json_schema format.
// Kept flat (no $ref, no anyOf) — Gemini via OpenRouter doesn't support complex JSON Schema.
const RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sets'],
  properties: {
    sets: {
      type: 'array',
      items: {
        type: 'object',
        required: ['setName', 'hardwareItems'],
        properties: {
          setName: { type: 'string' },
          hardwareItems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['qty', 'item', 'manufacturer', 'description', 'finish'],
              properties: {
                qty:          { type: 'integer' },
                item:         { type: 'string' },
                manufacturer: { type: 'string' },
                description:  { type: 'string' },
                finish:       { type: 'string' },
              },
            },
          },
          notes: { type: 'string' },
        },
      },
    },
  },
};

// Passed to OpenRouter as:
response_format: {
  type: 'json_schema',
  json_schema: { name: 'hardware_extraction', schema: RESPONSE_SCHEMA, strict: false }
}
```

**Important schema decisions:**
- Root is `{ sets: [] }` object, not a bare array — OpenAI `json_schema` format requires object root
- `strict: false` — Gemini via OpenRouter rejects `strict: true`
- No `$ref`, no `anyOf`, no `nullable` — Gemini schema support via OpenRouter is limited to flat structures
- A fallback parser handles the case where the model returns a bare array anyway (adds a warning, still parses)

---

## 6. Implementation Plan

### Phase 1 — Core ✅ DONE

**`services/hardwarePdfServiceV2.ts`** — implemented
- `extractHardwareSetsFromPdf(buffer, fileName, projectId)` — main function
- `saveDebugFiles()` — writes raw/parsed/meta to `debug-extractions/` (DEV only)
- `normalizeSet()` / `normalizeItem()` — type-safe normalizers, no `any`
- `parseResponse()` — unwraps `{ sets }` envelope + bare-array fallback

**`app/api/projects/[id]/hardware-pdf/route.ts`** — updated
- Was: `POST { pages: string[], fileName }` JSON body
- Now: `POST multipart/form-data` with `file` field (raw PDF)
- Returns: `{ setCount, itemCount, durationMs, warnings }`
- `pageCount` removed (not applicable — full PDF sent in one call)

**Client upload (pattern — UI component not yet built)**
```ts
const form = new FormData();
form.append('file', file);  // raw PDF File object — no client-side processing
await fetch(`/api/projects/${projectId}/hardware-pdf`, {
  method: 'POST',
  credentials: 'include',
  body: form,
});
```

**`scripts/test-pdf-extraction.ts`** — standalone test script
- Calls service directly (no HTTP server needed)
- Run: `npx tsx scripts/test-pdf-extraction.ts`
- Reads `docs/data/HARDWARE - DIV 08.pdf` and prints results + writes debug files

---

### Phase 2 — Reliability (not yet built)

- Tier 2 fallback: auto-trigger when Tier 1 fails or file > 15 MB
- Server-side pdfjs text extraction (Node build, not browser)
- Position-aware column reconstruction using x/y item coordinates from pdfjs
- Parallel AI batches (not sequential) with `json_schema` format
- Per-set confidence flag in the response
- Re-extraction API endpoint (re-run without re-uploading the file)
- `maxDuration` increase or streaming for very large PDFs

---

### Phase 3 — UI (not yet built)

- Upload card component in ProjectView (drag-and-drop or file picker)
- Progress indicator during AI processing
- Results preview — list of extracted sets + item count per set
- Re-upload / re-extract button
- Link to debug-extractions output in dev mode

---

## 7. File Structure After V2

```
services/
  hardwarePdfService.ts       ← V1 — kept untouched (sequential text batches)
  hardwarePdfServiceV2.ts     ← NEW ✅: OpenRouter base64 inline PDF approach

lib/
  ai/
    generate.ts               ← Keep: OpenRouter + Gemini text generation
    geminiFiles.ts            ← NOT CREATED — not needed, OpenRouter has no Files API

app/
  api/
    projects/
      [id]/
        hardware-pdf/
          route.ts            ← UPDATED ✅: multipart file → V2 service

scripts/
  test-pdf-extraction.ts      ← NEW ✅: standalone test script (no server needed)

debug-extractions/            ← gitignored, created at runtime in DEV
  {id}_{ts}_raw.txt
  {id}_{ts}_parsed.json
  {id}_{ts}_meta.json
```

---

## 8. OpenRouter PDF Support — Key Facts

| Property | Value |
|---|---|
| PDF transport | Base64 inline in message content (`data:application/pdf;base64,...`) |
| Content type field | `type: 'image_url'` with `image_url.url` set to the data URI |
| Processing engine | `native` (default) — Gemini reads the real PDF layout |
| Other engines | `cloudflare-ai` (free, converts to markdown — loses table structure, avoid) / `mistral-ocr` ($2/1000 pages — for fully scanned docs only) |
| Practical size limit | ~15 MB PDF (base64 adds ~33% overhead; no documented hard limit from OpenRouter) |
| Files API | Not available on OpenRouter — no persistent file URIs |
| Structured output | `response_format: { type: 'json_schema', json_schema: { ... } }` — works for Gemini models, `strict: false` required |
| Model used | `google/gemini-2.5-flash` |

The PDF is not stored anywhere — it is sent once, the AI extracts from it, and only the resulting JSON is persisted to Supabase.

---

## 9. Prompt Design

Unlike V1 (which had to enumerate item names, finish codes, and line formats because the AI was reading degraded plain text), V2 uses a much simpler prompt — the model sees the real PDF layout and can interpret it directly.

**System prompt (implemented in `hardwarePdfServiceV2.ts`):**
```
You are a construction document parser specializing in Division 08 door hardware schedules.
Your job is to extract every hardware set from the uploaded PDF and return them as structured JSON.

RULES:
- Extract ALL hardware sets — do not skip any.
- Each hardware set has a code (e.g. "AD01b", "SE02a.W", "CA01") — use this as setName.
- Each set contains hardware items: quantity, item type, manufacturer, part description, finish code.
- qty must be an integer. Use 1 if not stated.
- Preserve finish codes exactly as written (e.g. 626, 628, 630, CA, C, 689, ANOD, PT).
- If a note applies to a set, put it in the notes field.
- Items marked "By Others" — include them, put "By Others" in the description.
- Do not include the door index table — only extract hardware set definitions.
- Return results in the JSON format defined by the response schema.
```

**User prompt:**
```
Extract all hardware sets from this document. Return every set and every item.
```

No hardcoded item category lists. No finish code enumeration. The model reads the document and figures out the structure itself.

---

## 10. What We Are NOT Changing

- `services/doorScheduleService.ts` — Excel parsing is already server-side and working correctly
- `lib/db/hardware.ts` — DB layer and types are correct, no changes needed
- `app/api/projects/[id]/door-schedule/route.ts` — Excel upload route is done
- `lib/ai/generate.ts` — OpenRouter/Gemini text generation (still used for Tier 2 fallback)
- `supabase/migrations/004_relational_hardware_schema.sql` — schema is correct

---

## 11. Success Criteria

### Phase 1 (core pipeline)
- [ ] `HARDWARE - DIV 08.pdf` extracts all sets with correct set names, item counts, manufacturers, and finish codes — verified via `scripts/test-pdf-extraction.ts` and `debug-extractions/` output
- [ ] Extracted `setName` values match `hwSet` codes in the door schedule (e.g. "AD01b" = "AD01b") — required for the merge step
- [ ] Re-uploading the same PDF replaces the previous row (upsert with `onConflict: project_id` works)
- [ ] No `any` TypeScript in `hardwarePdfServiceV2.ts` or the updated route

### Phase 2 (reliability)
- [ ] A scanned PDF extracts correctly (Gemini vision path)
- [ ] A PDF > 15 MB triggers Tier 2 fallback automatically
- [ ] A 50+ page PDF completes within the 120s `maxDuration` limit
- [ ] Tier 2 fallback produces a usable result when Tier 1 fails

### Phase 3 (UI)
- [ ] Upload component works end-to-end in the browser for the MMH project
- [ ] Progress state is shown during the AI call
- [ ] Extracted sets are visible in the UI after upload
