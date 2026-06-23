# PlanckOff — AI Integration, PDF Pipeline & Performance
> Codebase Onboarding Guide · Part 3 of 3

---

## How AI Works in PlanckOff — The Complete Picture

AI is used in three places:
1. **Extract doors** from an uploaded PDF/Excel/CSV
2. **Extract hardware sets** from an uploaded PDF
3. **Assign the right hardware set** to each door

All three follow the same secure flow — the browser never touches the AI API directly.

---

## The Secure AI Call Flow

```
Browser (Client)
  │
  │  POST /api/ai/generate
  │  { prompt: "...", model: "gemini-2.5-flash", provider: "gemini" }
  │
  ▼
Next.js API Route (Server)
  │
  │  reads GEMINI_API_KEY from process.env  ← key NEVER leaves server
  │
  ▼
Google Gemini API
  │
  │  returns { text: "json string..." }
  │
  ▼
Next.js API Route
  │  returns { text: "..." }
  │
  ▼
Browser (Client)
  │
  ▼
safeParseJson() — repair + parse JSON
  │
  ▼
Structured door/hardware data
```

**Why this matters:** If you called Gemini from the browser, the API key would be visible in the JavaScript bundle or network tab. Anyone could steal it and run up your bill. The server proxy is non-negotiable for production.

---

## The PDF Pipeline — Step by Step

This is the most complex part of the app. Here is exactly what happens when a user uploads a 200-page PDF.

### Step 1: File Validation (fileUploadService.ts)

```
User selects file
  ↓
Check file size (max 10MB)
Check file type (pdf/xlsx/csv/docx)
  ↓
Route to the right parser:
  .pdf  → extractTextGenerator (pdfParser.ts)
  .xlsx → xlsxParser
  .csv  → csvParser
  .docx → docxParser
```

### Step 2: PDF Text Extraction (pdfParser.ts)

The key function is `extractTextGenerator` — it's an **async generator**. Instead of loading all 200 pages at once (which would crash the browser), it processes **20 pages at a time** and yields each batch as it finishes.

```
PDF file (200 pages)
  ↓
pdfjs-dist loads the PDF
  ↓
Batch 1: Pages 1-20  → extract text → yield { text, progress: 10% }
Batch 2: Pages 21-40 → extract text → yield { text, progress: 20% }
...
Batch 10: Pages 181-200 → extract text → yield { text, progress: 100% }
```

**Within each batch**, pages are processed in **parallel** using `Promise.all`. This is important — 20 pages process simultaneously, not one by one.

**Between batches**, we yield control back to the event loop with a 10ms pause. This is what keeps the UI responsive — it lets the browser process any pending user interactions.

```javascript
// How an async generator works (simplified)
async function* extractTextGenerator(file, batchSize = 20) {
  const pdf = await loadPDF(file);
  
  for (let i = 0; i < pdf.numPages; i += batchSize) {
    // Process this batch of pages in parallel
    const pageTexts = await Promise.all(
      pages.slice(i, i + batchSize).map(page => page.getText())
    );
    
    // Yield this batch's result to the caller
    yield {
      text: pageTexts.join('\n\n'),
      progress: Math.round(((i + batchSize) / pdf.numPages) * 100)
    };
    
    // Give the browser a breath
    await new Promise(r => setTimeout(r, 10));
  }
}
```

**What is an async generator?** A function that can pause (`yield`) and resume multiple times. Unlike a regular `async function` that returns one result, a generator produces a stream of results over time. Perfect for streaming large file processing.

### Step 3: AI Extraction (geminiService.ts)

Each batch of text from Step 2 is sent to the AI for extraction:

```
Batch text (20 pages of PDF text)
  ↓
Split into chunks (10 pages per chunk)
  ↓
For each chunk: POST /api/ai/generate with this prompt:
  "Extract all doors from the following text. Return JSON array.
   Fields: doorTag, location, width, height, material, fireRating..."
  ↓
Gemini returns JSON string
  ↓
safeParseJson() repairs and parses it
  ↓
Array of Door objects
```

**Why split further into 10-page chunks?** AI models have token limits. A 20-page batch might exceed the context window, causing errors. Smaller chunks are more reliable.

**CONCURRENCY = 1**: Currently chunks are processed one at a time. This is conservative — suitable for free-tier API limits. On paid tiers, increasing concurrency to 3-5 would make extraction 3-5x faster.

### Step 4: Hardware Assignment

After doors are extracted, each door is matched to a hardware set:

**Priority order:**
1. **Exact match** — if the door says "HW-1" and a set named "HW-1" exists → confidence HIGH
2. **Normalized match** — "Set-01" normalizes to "01" → confidence MEDIUM
3. **AI match** — AI reads door specs (material, fire rating, location) and picks the best set → confidence LOW

The AI assignment prompt includes:
- All available hardware sets (name, description, division)
- Learned examples from previous correct assignments (MLOps)
- The door's properties (tag, type, material, fire rating, electrification)

---

## The JSON Repair System

AI models don't always return perfectly valid JSON. Common problems:
- Missing comma between two fields
- Trailing comma after the last item in an array
- Unescaped quote inside a string value
- Markdown code fences (\`\`\`json\`\`\`) wrapping the JSON
- Response cut off mid-way due to token limit

Our `safeParseJson()` function handles all of these iteratively:

```
Step 1: Strip markdown code fences
Step 2: Find where the JSON starts and ends ({ or [)
Step 3: Try JSON.parse()
  If success → return result
  If SyntaxError:
    Read the error message to find the position
    Apply a heuristic fix at that position:
      - Missing comma? Insert one
      - Trailing comma? Remove it
      - Unescaped quote? Escape it
    Try JSON.parse() again
    Repeat up to 100 times
```

This means even if Gemini returns 90% valid JSON with a few syntax errors, we still get usable data instead of throwing an error.

---

## MLOps — Learning from Corrections

When an estimator manually overrides an AI-assigned hardware set (because the AI got it wrong), we capture that correction as a learning example:

```
AI assigned: "HW-2" (confidence: low)
User corrected to: "HW-5"
  ↓
mlOpsService.captureExample({
  doorTag: "101",
  doorProperties: { material: "HM", fireRating: "1 HR", location: "Stair" },
  incorrectSet: "HW-2",
  correctSet: "HW-5"
})
  ↓
Stored as learned examples (localStorage currently, moving to Supabase)
  ↓
Next AI assignment prompt includes:
  "In the past, a door similar to this was corrected from HW-2 to HW-5.
   Consider this when making your assignment."
```

This is **few-shot learning** — we're giving the AI examples of correct behavior to improve future accuracy without retraining the model.

---

## Auto Hinge Quantity Adjustment

A small but important business rule that's baked in as code (not AI):

- **Door height ≤ 90 inches → 3 hinges**
- **Door height > 90 inches → 4 hinges**

After AI assigns a hardware set, this rule is applied automatically. The AI doesn't need to figure this out — it's a deterministic rule. This is a good example of **hybrid intelligence**: use AI for the complex ambiguous stuff, use code for the deterministic rules.

---

## AI Provider Strategy — Gemini + OpenRouter

The app supports two AI providers:

| Provider | Used For | Why |
|---|---|---|
| **Google Gemini 2.5-Flash** | Primary | Fast, cheap, supports structured JSON output natively, vision support |
| **OpenRouter** | Fallback + alternatives | Routes to GPT-4, Claude, Mistral etc.; good if Gemini is down or rate-limited |

The user can switch providers in the Settings page. The server API route handles both:

```typescript
const text = provider === 'gemini'
  ? await generateWithGemini(prompt, model, schema, temperature)
  : await generateWithOpenRouter(prompt, model, schema, temperature);
```

**Why Gemini 2.5-Flash specifically?**
- Optimized for speed (lower latency than Gemini Pro)
- Supports `responseSchema` — you give it a JSON schema and it guarantees the output matches it (reduces JSON repair needs)
- Has vision capabilities (for analyzing door elevation images)
- Cost-effective for high-volume extraction

---

## How to Make the App More Snappy — Performance Analysis

---

### Bottleneck 1: PDF Extraction is Sequential (CONCURRENCY = 1)

**Problem:** A 200-page PDF creates 20 chunks of text. These are sent to Gemini one by one. If each call takes 3 seconds, the whole extraction takes 60 seconds.

**Fix: Increase concurrency**
```javascript
const CONCURRENCY = 1;  // Current (safe for free tier)
const CONCURRENCY = 5;  // Better (for paid tier)
```

With `CONCURRENCY = 5`, 5 chunks are processed simultaneously → 60 seconds → ~15 seconds.

**Why not unlimited concurrency?** Gemini has rate limits (requests per minute). You'd get 429 (Too Many Requests) errors. The right value depends on your API tier.

**Better solution: Job Queue with exponential backoff**
```
Queue all chunks
Process N at a time
If 429 received → wait and retry with increasing delay (1s, 2s, 4s, 8s...)
Track completed chunks for progress reporting
```

---

### Bottleneck 2: Single Web Worker (No Worker Pool)

**Problem:** There's one Web Worker. If two users upload files simultaneously (or one user uploads two files), the second upload waits.

**Fix: Worker pool**
```javascript
// Current
const worker = new Worker('upload.worker.ts');

// Better
const POOL_SIZE = 3;
const workerPool = Array.from({ length: POOL_SIZE }, () => new Worker('upload.worker.ts'));
// Round-robin or least-busy assignment
```

This is more relevant for desktop app scenarios. On the web, each browser tab has its own worker.

---

### Bottleneck 3: ProjectContext Re-renders Everything

**Problem:** `ProjectContext` holds projects, doors, hardware sets, elevation types all in one big state. When one door is edited, every component that reads from this context re-renders — even the sidebar, even the project list.

**Fix: Split the context**
```
ProjectListContext   — project summaries for the dashboard
ActiveProjectContext — the currently open project's metadata
DoorsContext        — doors for the active project (most frequently updated)
HardwareContext     — hardware sets (less frequently updated)
ElevationContext    — elevation types (rarely updated)
```

With split contexts, editing a door only re-renders components subscribed to `DoorsContext`.

**Alternative:** Use `React.memo` on expensive components and `useMemo`/`useCallback` on values/functions passed as props.

---

### Bottleneck 4: Large Door Tables are Slow

**Problem:** A project might have 300+ doors. Rendering all of them as table rows at once is slow.

**Fix: Virtual scrolling**
Using a library like `@tanstack/virtual` or `react-window`:
- Only render the rows currently visible in the viewport
- As the user scrolls, render new rows and discard offscreen rows
- 300 rows → only ~20 DOM elements at any time
- Result: near-instant render regardless of list size

---

### Bottleneck 5: Every Page Load Fetches All Projects

**Problem:** On the dashboard, we fetch all projects. If you have 100 projects, that's a lot of data transferred and parsed.

**Fix: Pagination + React Query caching**
```typescript
// Instead of: fetch all projects
const { projects } = await getProjectsByAdmin(adminId);

// Better: paginate
const { projects, total } = await getProjectsByAdmin(adminId, {
  page: 1,
  pageSize: 20,
  orderBy: 'updated_at DESC'
});
```

Combine with **TanStack Query** (React Query) for:
- Automatic caching — second visit to dashboard loads instantly from cache
- Background refetch — cache refreshes silently without blocking the UI
- Stale-while-revalidate — show cached data immediately, update when fresh data arrives

---

### Bottleneck 6: Images (Elevations) Stored as Base64

**Problem (legacy):** Elevation images were stored as base64 strings inside the JSONB project blob. A 1MB image becomes 1.37MB of text. Loading a project with 5 elevations = 7MB just for images, embedded in the JSON response.

**Fix (already in migration 005):** Store images in Supabase Storage. The project record stores only the URL. The browser fetches images separately (and browsers cache images aggressively).

```
Before: project JSON = 8MB (includes base64 images)
After:  project JSON = 20KB + browser fetches image URLs (cached after first load)
```

---

### Bottleneck 7: No Search/Filter at the Database Level

**Problem:** When filtering doors by fire rating, we load ALL doors and filter in JavaScript.

**Fix:** Push filtering to SQL.
```sql
-- Instead of: load all, filter in JS
SELECT * FROM projects WHERE id = $1;
-- Then JS: projects.doors.filter(d => d.fireRating === '1 HR')

-- Better: parameterized door query
SELECT * FROM doors 
WHERE project_id = $1 AND fire_rating = $2
LIMIT 50 OFFSET $3;
```

This requires the relational schema migration (already planned as Phase 2).


## Quick Reference — Key Numbers

| Metric | Current Value | Why |
|---|---|---|
| PDF batch size | 20 pages | Memory vs. throughput balance |
| AI chunk size | 10 pages | Token limit safety margin |
| Concurrency | 1 | Free tier API rate limit |
| Max file size | 10MB | Worker memory constraints |
| Max JSON repair attempts | 100 | Practical limit for iterative repair |
| Hinge threshold | 90 inches door height | Industry standard |
| Session expiry | Configurable (in auth_sessions) | Security best practice |

---
