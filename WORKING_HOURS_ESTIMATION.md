# Working Hours Estimation — Hardware Estimating Platform
**Prepared by:** Harsh Patel
**Based on:** Full Codebase Analysis (re-analysed March 2026)
**Date:** March 2026
**Methodology:** Bottom-up estimation, per-task breakdown with 15-minute granularity

---

## Revision Notice (March 2026)

The original Phase 2 estimate was written **without reading the current implementation in detail**. After a full code review, significant parts of the basic AI PDF pipeline already exist:

- `pdfParser.ts` — `extractTextGenerator` with page batching (✅ exists)
- `geminiService.ts` — `extractDoorsFromText`, `extractHardwareSetsFromText` with chunking + prompts + schema + JSON repair (✅ exists)
- `fileUploadService.ts` — chunked PDF processing, streaming `onData` callback, abort signal (✅ exists)
- `upload.worker.ts` — Web Worker offloading all processing off main thread (✅ exists)
- `aiProviderService.ts` — Gemini + OpenRouter abstraction with retry (✅ exists)

**The issue is not that the feature doesn't exist. The issue is that the current architecture breaks at scale.**

For a 200+ page PDF, the current system will:
1. Take 30–60+ minutes due to `CONCURRENCY = 1` sequential AI calls
2. Miss hardware data that spans page boundaries
3. Have no way to resume if a call fails mid-way through
4. Re-chunk text by `\n\n` inside the AI service (conflicting with page-level batching already done in the parser)
5. Have no way to skip irrelevant pages (cover pages, details, schedules — not doors/hardware)

**This document has been updated to reflect: what needs an architectural overhaul vs what is already done.**

---

## How to Read This Document

Each task has:
- **Hours** — realistic engineering time (not calendar time)
- **Complexity** — Low / Medium / High / Very High
- **Status** — identifies whether this is a Bug Fix, Refactor, New Feature, or Architecture

Estimates assume one mid-to-senior full-stack developer working alone.

---

## GRAND TOTAL SUMMARY

| Phase | Area | Hours |
|---|---|---|
| Phase 0 | Project Setup & Environment | 9 h |
| Phase 1 | Security & Authentication | 53 h |
| Phase 2 | AI PDF Pipeline — Architecture Overhaul | 58 h |
| Phase 3 | Performance Fixes | 22 h |
| Phase 4 | Code Quality & TypeScript | 21 h |
| Phase 5 | Architecture & Testing | 38 h |
| Phase 6 | UX & Reliability | 12 h |
| **TOTAL** | | **213 hours** |

At a standard 40-hour work week, this is approximately **5.5 weeks** of focused engineering work.

---

---

# PHASE 0 — Project Setup & Environment

*One-time tasks needed before any real work can begin.*

---

## 0.1 Audit & Dependency Cleanup
**Status:** Setup | **Complexity:** Low

| Task | Time |
|---|---|
| Review all 24 installed packages for outdated/unused ones | 30 min |
| Remove unused packages (if any found) | 30 min |
| Update packages to latest stable versions | 45 min |
| Verify app still runs after updates | 45 min |
| **Subtotal** | **2 h 30 min** |

---

## 0.2 Environment Configuration
**Status:** Setup | **Complexity:** Low

| Task | Time |
|---|---|
| Create `.env.example` with all required vars documented | 30 min |
| Set up `.env.development` and `.env.production` files | 30 min |
| Configure Vite env variable handling for all environments | 30 min |
| Set up Supabase project (cloud) with correct region | 45 min |
| **Subtotal** | **2 h 15 min** |

---

## 0.3 CI/CD Pipeline Setup
**Status:** Setup | **Complexity:** Medium

| Task | Time |
|---|---|
| Set up GitHub Actions workflow for lint + type check | 45 min |
| Set up automated test runner in CI | 45 min |
| Set up preview deployments on PR (Vercel or Netlify) | 45 min |
| Set up production deployment pipeline | 45 min |
| **Subtotal** | **3 h** |

---

## 0.4 Eslint + Prettier Configuration
**Status:** Setup | **Complexity:** Low

| Task | Time |
|---|---|
| Configure ESLint with TypeScript + React rules | 30 min |
| Configure Prettier for consistent formatting | 15 min |
| Run auto-fix across codebase | 15 min |
| **Subtotal** | **1 h** |

**Phase 0 Total: ~9 hours**

---

---

# PHASE 1 — Security & Authentication

*These are the highest-priority issues. Nothing else should ship without this phase being complete.*

---

## 1.1 Real Supabase Authentication — Replace Mock Auth
**Status:** Bug Fix / New Feature | **Complexity:** High
**Broken file:** `contexts/AuthContext.tsx`

The current `logout()` function sets `isAuthenticated = true` (bug). `login()` always succeeds. There is no credential validation anywhere.

| Task | Time |
|---|---|
| Create Supabase Auth schema (users table, RLS policies) | 1 h |
| Implement `signUp(email, password)` with email confirmation | 1 h |
| Implement `signIn(email, password)` with real Supabase call | 1 h |
| Fix `logout()` — call `supabase.auth.signOut()`, clear state | 30 min |
| Persist session using Supabase's built-in session management | 45 min |
| Replace `localStorage` user object with Supabase session | 1 h |
| Add `onAuthStateChange` listener to keep state in sync | 30 min |
| Wire RBAC roles into Supabase user metadata | 1 h |
| Update `ProtectedRoute` to redirect unauthenticated users | 30 min |
| Build Login page UI (email + password form, validation) | 2 h |
| Build Sign Up page UI with confirmation email messaging | 1 h 30 min |
| Build "Forgot Password" flow (send reset email) | 1 h |
| End-to-end testing of full auth flow | 1 h |
| **Subtotal** | **13 h 45 min** |

---

## 1.2 Move AI API Keys to Backend Proxy
**Status:** Critical Security Fix | **Complexity:** High
**Broken files:** `vite.config.ts`, `services/aiProviderService.ts`

Currently both Gemini and OpenRouter API keys are bundled into the client-side JavaScript bundle. Anyone can extract them from Chrome DevTools. Also, `dangerouslyAllowBrowser: true` is set explicitly for the OpenRouter client.

**Note:** This task is now also a prerequisite for the PDF pipeline architecture (Phase 2). Server-side AI calls are the only way to safely enable controlled parallelism and higher rate limits for large PDFs.

| Task | Time |
|---|---|
| Create Supabase Edge Function: `/ai/gemini` proxy endpoint | 1 h 30 min |
| Create Supabase Edge Function: `/ai/openrouter` proxy endpoint | 1 h |
| Move API keys from `.env` client vars to Supabase secrets | 30 min |
| Update `aiProviderService.ts` to call edge functions instead of direct APIs | 1 h 30 min |
| Remove `GEMINI_API_KEY` from `vite.config.ts` define block | 15 min |
| Remove `dangerouslyAllowBrowser: true` from OpenAI client | 15 min |
| Add auth token forwarding to edge functions (only authenticated users can call AI) | 45 min |
| Handle error responses from edge functions in frontend | 45 min |
| Test all AI features through new proxy | 1 h |
| **Subtotal** | **7 h 30 min** |

---

## 1.3 Migrate All Data from localStorage to Supabase
**Status:** Critical Architecture Fix | **Complexity:** Very High
**Broken files:** `contexts/ProjectContext.tsx`, `lib/supabase.ts`, 33+ localStorage read/write operations

Currently the entire application stores data in the browser's 5MB localStorage. Data is lost if the user switches browsers. No collaboration is possible. No backups exist.

| Task | Time |
|---|---|
| Design database schema (Projects, Doors, HardwareSets, HardwareItems, Settings, Team) | 2 h |
| Write SQL migrations for all tables | 1 h 30 min |
| Configure Row Level Security (RLS) policies per table | 1 h 30 min |
| Rewrite `ProjectContext.tsx` — replace localStorage reads with `supabase.from().select()` | 3 h |
| Rewrite project create/update/delete with Supabase mutations | 2 h |
| Migrate door schedule operations to Supabase | 2 h 30 min |
| Migrate hardware sets operations to Supabase | 2 h |
| Migrate app settings (AI keys, preferences) to Supabase user settings table | 1 h |
| Write one-time data migration utility (export localStorage → import to Supabase) for existing users | 2 h |
| Test data integrity after migration | 1 h |
| **Subtotal** | **19 h 30 min** |

---

## 1.4 File Upload Validation
**Status:** Security Fix | **Complexity:** Low
**Broken files:** `services/fileUploadService.ts`, `utils/csvParser.ts`, `utils/xlsxParser.ts`, `utils/pdfParser.ts`

No file type, size, or row count validation exists on any upload path. (The 10MB limit is in `fileUploadService.ts` but there is no MIME type allowlist, no row count cap, and no content structure validation before AI is called.)

| Task | Time |
|---|---|
| Add MIME type allowlist (PDF, XLSX, XLS, CSV, DOCX only) | 45 min |
| Raise file size limit to 100MB for large PDFs (now that processing is chunked server-side) | 30 min |
| Add row count limit (max 2,000 rows) before processing begins | 45 min |
| Add content structure validation before sending to AI | 45 min |
| User-facing error messages for each validation failure | 30 min |
| **Subtotal** | **3 h 15 min** |

---

## 1.5 Real Team Invite System
**Status:** Bug Fix | **Complexity:** Medium
**Broken file:** `components/InviteUserPanel.tsx`, `views/TeamManagement.tsx`

Invites are stored in memory only. No actual emails are sent. No invite links are generated. The entire team management system is non-functional.

| Task | Time |
|---|---|
| Implement Supabase Auth invite-by-email (`inviteUserByEmail()`) | 1 h |
| Persist team members + roles in Supabase `team_members` table | 1 h |
| Add RFC-compliant email format validation on invite form | 30 min |
| Update TeamManagement view to load real members from DB | 1 h |
| Handle pending invite status display | 30 min |
| Resend / cancel invite functionality | 45 min |
| **Subtotal** | **4 h 45 min** |

---

## 1.6 AI API Key Management UI (Secure)
**Status:** New Feature | **Complexity:** Medium
**Affected files:** `services/aiProviderService.ts`

| Task | Time |
|---|---|
| Settings UI — AI provider selector (Gemini / OpenRouter) | 1 h |
| API key input field with masked display (show/hide toggle) | 30 min |
| "Test Connection" button — makes a minimal API call to validate key | 1 h |
| Store API key securely in Supabase user settings (not localStorage) | 45 min |
| Retrieve key server-side in edge function per authenticated user | 45 min |
| **Subtotal** | **4 h** |

**Phase 1 Total: ~53 hours**

---

---

# PHASE 2 — AI PDF Pipeline: Architecture Overhaul

**What currently exists (do NOT re-estimate these):**
- `extractTextGenerator` — page-level batched PDF parsing ✅
- `extractDoorsFromText` / `extractHardwareSetsFromText` — text chunking + AI extraction + JSON repair ✅
- Structured schemas for door and hardware set extraction ✅
- `fileUploadService.ts` — chunked pipeline wiring PDF → AI → `onData` streaming ✅
- Single upload Web Worker with abort support ✅
- Retry logic in both Gemini and OpenRouter providers ✅

**What is broken at scale (200+ page PDFs):**

| Problem | Location | Impact |
|---|---|---|
| `CONCURRENCY = 1` sequential AI calls | `geminiService.ts:462, 659` | 200-page PDF = 20 sequential AI calls, 10–30 min total |
| Text re-split by `\n\n` inside AI service, conflicting with page-level batching | `geminiService.ts:447, 642` | Unpredictable chunk boundaries, potential context loss |
| Hardware sets / doors that span page boundaries are split and lost | `fileUploadService.ts:210–232` | Data loss at every batch seam |
| No page relevance triage — every page (including cover pages, details) sent to AI | `fileUploadService.ts:210` | 50–70% of AI calls on a typical project PDF are wasted |
| No checkpoint / resume — if call #15 of 20 fails, user starts over | entire pipeline | Very bad UX for large files |
| JSON repair loop (100 iterations) — no early exit, still runs if structured output fails | `geminiService.ts:34` | Causes delays; structured output already enforced so repair rarely needed |
| Single worker processes all uploads serially | `upload.worker.ts` | Two simultaneous PDF uploads block each other |

**Architecture decision: Rebuild vs Refactor**

The current pipeline is `extract text → split by \n\n → send to AI`. This structure is fundamentally wrong for large PDFs. The rebuild target is:

```
PDF → detect page roles (cover / schedule / details) → group relevant pages
    → parallel AI extraction with rate-limited queue
    → overlap stitching at chunk boundaries
    → merge + deduplicate results
```

This is a ground-up rewrite of the pipeline layer only. The UI, validation, types, and schema logic are all kept.

---

## 2.1 Page Relevance Triage (Pre-AI Filtering)
**Status:** New Architecture | **Complexity:** High

Before sending pages to AI, classify each page as relevant or irrelevant using keyword heuristics on the extracted text. This eliminates 50–70% of AI calls on typical project PDFs.

| Task | Time |
|---|---|
| Define keyword sets for "door schedule page" (door tag patterns, size columns) | 1 h |
| Define keyword sets for "hardware set page" (HW-1, Set 01, lockset, closer, hinge) | 1 h |
| Write `classifyPage(text): 'door-schedule' \| 'hardware-set' \| 'irrelevant'` function | 1 h 30 min |
| Group consecutive relevant pages into logical sections | 1 h |
| Add a configurable relevance threshold (don't skip borderline pages) | 30 min |
| Log which pages were skipped and why (shown in import summary) | 45 min |
| Test against 3+ real project PDFs with 100+ pages | 1 h 30 min |
| **Subtotal** | **7 h 15 min** |

---

## 2.2 Parallel AI Call Queue with Rate Limiting
**Status:** Architecture Rebuild | **Complexity:** Very High

Replace `CONCURRENCY = 1` serial processing with a controlled-concurrency queue. This is the single biggest performance win. With the edge function proxy from Phase 1.2, server-to-server calls get higher rate limits than browser calls.

| Task | Time |
|---|---|
| Design queue data structure: `PendingChunk { id, text, type, pageRange }` | 1 h |
| Implement `AsyncQueue(concurrency: number)` — processes N items at a time, waits for slot to free | 2 h |
| Wire queue into both `extractDoorsFromText` and `extractHardwareSetsFromText` | 1 h 30 min |
| Implement per-provider rate limit awareness (Gemini free: 15 RPM, paid: 1000 RPM; OpenRouter: varies) | 1 h 30 min |
| Add jitter to retry delays to avoid thundering herd on 429 | 30 min |
| Expose concurrency setting in app settings UI | 45 min |
| Test 200-page PDF end-to-end, verify timing improvement | 1 h 30 min |
| **Subtotal** | **8 h 45 min** |

---

## 2.3 Chunk Boundary Overlap & Stitching
**Status:** Architecture Fix | **Complexity:** High

When page 10 ends mid-sentence or mid-hardware-set, the current system loses that data. Fix with overlapping chunks and a deduplication pass.

| Task | Time |
|---|---|
| Add configurable overlap: each chunk includes last N lines of previous chunk | 1 h 30 min |
| After extraction, run deduplication pass: if same doorTag / set name appears in adjacent chunks, merge | 2 h |
| Handle split hardware set items (same set name, different items in adjacent chunks) — merge items, not duplicate sets | 1 h 30 min |
| Write tests for boundary stitching with synthetic split scenarios | 1 h |
| **Subtotal** | **6 h** |

---

## 2.4 Checkpoint & Resume for Large PDFs
**Status:** New Architecture | **Complexity:** High

For a 200-page PDF, if API call #18 of 20 fails (network drop, rate limit exhaustion), the user currently sees an error and loses all previous results. Need a checkpoint system.

| Task | Time |
|---|---|
| Store completed chunk results in IndexedDB keyed by `(fileHash, chunkIndex)` | 1 h 30 min |
| On retry or resume, skip chunks that already have stored results | 1 h |
| Add "Resume" button to upload progress UI if an in-progress extraction is detected | 1 h 30 min |
| Clear checkpoint on successful completion or user-initiated cancel | 30 min |
| **Subtotal** | **4 h 30 min** |

---

## 2.5 Fix Internal Re-chunking Conflict
**Status:** Architecture Fix | **Complexity:** Medium

`extractDoorsFromText` and `extractHardwareSetsFromText` in `geminiService.ts` re-split the text by `\n\n` and create their own chunks. But `fileUploadService.ts` already processes by page batch before calling these functions. The result is double-chunking with unpredictable boundaries.

Fix: These functions should receive pre-chunked text (one chunk = one logical page range) and send it directly to AI, not re-chunk internally.

| Task | Time |
|---|---|
| Refactor `extractDoorsFromChunk` to be the new primary function (takes one pre-chunked string) | 1 h |
| Remove internal re-chunking from `extractDoorsFromText` | 45 min |
| Same refactor for `extractHardwareSetsFromChunk` / `extractHardwareSetsFromText` | 1 h |
| Update `fileUploadService.ts` to call chunk-level functions directly through the new queue | 1 h |
| Verify door/hardware set counts match before/after refactor on test PDFs | 1 h |
| **Subtotal** | **4 h 45 min** |

---

## 2.6 JSON Repair Loop Cleanup
**Status:** Performance Fix | **Complexity:** Low
**File:** `geminiService.ts:34`

The `safeParseJson` function runs up to 100 iterations. With structured output schemas enforced (which both Gemini and OpenRouter support), well-formed JSON is already returned most of the time. The loop is a safety net that runs unnecessarily and can lock the worker thread.

| Task | Time |
|---|---|
| Reduce max iterations from 100 to 10 with early exit | 15 min |
| Add detection: if provider returned valid structured output, skip repair entirely | 30 min |
| Log repair attempts to catch providers that frequently return malformed JSON | 15 min |
| **Subtotal** | **1 h** |

---

## 2.7 Worker Pool (Parallel File Processing)
**Status:** Architecture Fix | **Complexity:** Medium
**File:** `contexts/BackgroundUploadContext.tsx`

Currently a single Web Worker processes all uploads serially. Two simultaneous uploads block each other. With 200-page PDFs that take minutes to process, this is unacceptable.

| Task | Time |
|---|---|
| Create `WorkerPool` class managing 2–3 `upload.worker.ts` instances | 2 h |
| Update `BackgroundUploadContext.tsx` to use pool for dispatch | 1 h 30 min |
| Handle worker task queue — queue tasks when all workers are busy | 1 h |
| Graceful error handling and worker restart if a pooled worker crashes | 1 h |
| **Subtotal** | **5 h 30 min** |

---

## 2.8 Vision Fallback for Scanned/Image-Heavy PDFs
**Status:** New Feature | **Complexity:** High

Some construction PDFs are scanned (no text layer) or have schedules as embedded images. The current text extraction fails silently — `pdfjs-dist` returns empty strings. The `analyzeImageWithAI` function already exists and handles image input via Gemini Vision. Build a fallback pipeline that converts PDF pages to images and uses vision.

| Task | Time |
|---|---|
| Detect if a PDF page has no extractable text (text length < threshold after extraction) | 1 h |
| Render empty-text pages to canvas using `pdfjs-dist` page rendering API | 2 h |
| Convert canvas to base64 PNG and send to `analyzeImageWithAI` with structured prompt | 1 h 30 min |
| Merge vision-extracted results with text-extracted results | 1 h |
| Show "Vision Mode" indicator in upload progress for scanned pages | 30 min |
| Test with a sample scanned hardware schedule PDF | 1 h |
| **Subtotal** | **7 h** |

---

## 2.9 AI Extraction History & Audit Log
**Status:** New Feature | **Complexity:** Low

Keep a log of what was extracted from which file, when, and by whom. Depends on Supabase from Phase 1.3.

| Task | Time |
|---|---|
| Store extraction run metadata in Supabase (file name, date, page count, item count, user) | 45 min |
| Extraction history view in UI | 1 h |
| Ability to re-import or view a previous extraction run | 45 min |
| **Subtotal** | **2 h 30 min** |

---

## 2.10 Excel Hardware Catalog Upload & Parsing
**Status:** New Feature | **Complexity:** High

Upload an Excel file that contains a hardware catalog or price list and parse it into internal data structures. This is separate from the door schedule Excel upload.

| Task | Time |
|---|---|
| Excel upload UI (drag-and-drop, file browser) | 1 h |
| Extend `xlsxParser.ts` for hardware catalog format (vs door schedule format) | 2 h |
| Support multi-sheet workbooks (one sheet per hardware category) | 1 h 30 min |
| Intelligent column header detection for catalog fields (part no., description, list price, etc.) | 2 h |
| Handle merged cells in Excel tables (common in manufacturer catalogs) | 1 h 30 min |
| Row count and structure validation before processing | 30 min |
| Parse pricing data: list price, discount columns, net price calculation | 1 h 30 min |
| **Subtotal** | **10 h** |

**Phase 2 Total: ~57 hours**

> **Note:** The original Phase 2 estimate was ~66h assuming the PDF pipeline needed to be built from scratch. After seeing the current code, the basic flow already exists. The revised 57h reflects the architectural overhaul needed to make it work reliably at scale, with new capabilities (vision fallback, checkpoints, Excel catalog) added.

---

---

# PHASE 3 — Performance Fixes

---

## 3.1 Pagination / Virtual Scrolling on Data Tables
**Status:** Bug Fix | **Complexity:** Medium
**Broken files:** `views/DatabaseView.tsx`, `components/DoorScheduleManager.tsx`

All rows are rendered to the DOM simultaneously. 500+ doors will freeze the browser.

| Task | Time |
|---|---|
| Install and configure `@tanstack/react-virtual` | 30 min |
| Apply virtual scrolling to `DoorScheduleManager` table | 2 h |
| Apply virtual scrolling to `DatabaseView` inventory table | 1 h 30 min |
| Test with 500+ row dataset for performance | 1 h |
| **Subtotal** | **5 h** |

---

## 3.2 Component Memoization
**Status:** Bug Fix | **Complexity:** Low
**Broken files:** `views/Dashboard.tsx`, `components/DoorScheduleManager.tsx`, `components/Header.tsx`

| Task | Time |
|---|---|
| Apply `React.memo` to Dashboard project cards | 30 min |
| Apply `React.memo` to door row components | 45 min |
| Apply `React.memo` to Header component | 30 min |
| Add `useMemo` for filtered/sorted door datasets | 1 h |
| Add `useCallback` to event handlers passed as props | 1 h |
| **Subtotal** | **3 h 45 min** |

---

## 3.3 JSON Repair Performance Fix
**Status:** Bug Fix | **Complexity:** Medium
**Broken file:** `services/geminiService.ts`

*(Now partially addressed in Phase 2.6. This task covers the worker thread aspect.)*

| Task | Time |
|---|---|
| Verify JSON repair already runs inside `upload.worker.ts` (not on main thread) | 30 min |
| Confirm repair loop max iterations reduced (done in 2.6) | — |
| Add structured output schema to all AI calls to reduce malformed responses | 1 h |
| Test that UI remains responsive during long repair cycles | 30 min |
| **Subtotal** | **2 h** |

---

## 3.4 ML Examples In-Memory Cache
**Status:** Bug Fix | **Complexity:** Low
**Broken file:** `services/mlOpsService.ts`

`getLearnedExamples()` reads and parses localStorage on every AI call.

| Task | Time |
|---|---|
| Load learned examples once at module initialization | 30 min |
| Cache in module-level variable | 15 min |
| Invalidate cache on write/add operations | 30 min |
| **Subtotal** | **1 h 15 min** |

---

## 3.5 Supabase Query Optimization
**Status:** Performance | **Complexity:** Low

*Applies once Supabase migration from Phase 1.3 is done.*

| Task | Time |
|---|---|
| Add database indexes on commonly queried columns (project_id, door_tag) | 30 min |
| Review N+1 query patterns in context files | 45 min |
| Add pagination to all list queries (limit/offset or cursor) | 1 h |
| **Subtotal** | **2 h 15 min** |

---

## 3.6 AI Processing Step-by-Step Progress UI
**Status:** UX Fix | **Complexity:** Medium
**Broken files:** `components/NewProjectModal.tsx`, `views/DatabaseView.tsx`

No step-by-step progress shown during large PDF processing jobs (which now take longer, with multiple chunks).

| Task | Time |
|---|---|
| Define processing stages: "Classifying pages...", "Queuing X chunks for AI...", "Analyzing pages 1–10...", "Stitching results...", "Validating..." | 30 min |
| Emit granular progress events from worker at each stage | 1 h |
| Update `UploadProgressWidget.tsx` to show current stage + chunk progress | 1 h 30 min |
| Show "X of Y chunks completed" counter during parallel processing | 45 min |
| Add estimated time remaining indicator | 45 min |
| Test with slow network conditions | 30 min |
| **Subtotal** | **5 h** |

**Phase 3 Total: ~19 hours**

*(3.3 is reduced because 2.6 already handles most of it)*

---

---

# PHASE 4 — Code Quality & TypeScript

---

## 4.1 Replace 114+ `any` Types with Proper Interfaces
**Status:** Refactor | **Complexity:** High
**Affected files:** `types.ts`, `contexts/BackgroundUploadContext.tsx`, `utils/reportGenerator.ts`, `utils/xlsxParser.ts`, `services/geminiService.ts`

| Task | Time |
|---|---|
| Audit all `any` usages and categorize (truly dynamic vs lazy typing) | 1 h 30 min |
| Define missing types: `FinishSystem`, `PartialData`, and others flagged in audit | 2 h |
| Replace `any` with specific interfaces in `types.ts` | 1 h |
| Replace `any` in service files | 2 h |
| Replace `any` in utility functions | 1 h 30 min |
| Replace `any` in context files | 1 h |
| Use `unknown` + type guards where shape is truly dynamic | 1 h |
| **Subtotal** | **10 h** |

---

## 4.2 Standardize ID Generation
**Status:** Bug Fix | **Complexity:** Low
**Affected files:** Multiple contexts and services

Three different ID generation patterns — `Date.now()` alone can produce collisions.

| Task | Time |
|---|---|
| Find all ID generation sites across codebase | 30 min |
| Replace `Date.now()` and `Date.now() + Math.random()` with `crypto.randomUUID()` | 1 h |
| **Subtotal** | **1 h 30 min** |

---

## 4.3 Fix Silent Dimension Unit Conversion
**Status:** Bug Fix | **Complexity:** Low
**Broken file:** `services/fileUploadService.ts`

Currently converts values < 10 from feet to inches silently, with no user warning. This is in both `fileUploadService.ts` and `geminiService.ts` (duplicate logic).

| Task | Time |
|---|---|
| Remove the silent auto-conversion from `fileUploadService.ts` (keep only the one in `geminiService.ts`) | 15 min |
| Detect unit from column headers (look for "ft", "in", `'`, `"` in header names) | 1 h |
| If ambiguous, show a modal asking user to confirm unit (feet or inches) | 1 h |
| **Subtotal** | **2 h 15 min** |

---

## 4.4 Remove Debug Logs + Add Production Logger
**Status:** Code Quality | **Complexity:** Low
**Broken files:** `services/aiProviderService.ts`, `contexts/BackgroundUploadContext.tsx`, `services/libraryLoader.ts`, `components/ReportGenerationCenter.tsx`

Multiple `console.log('DEBUG: ...')` statements exist in the AI provider service that will log sensitive data in production.

| Task | Time |
|---|---|
| Remove all `console.log` and `console.debug` calls from production code | 1 h |
| Create a `logger.ts` utility gated by `import.meta.env.DEV` flag | 30 min |
| Replace necessary debug logs with the new logger | 30 min |
| **Subtotal** | **2 h** |

---

## 4.5 Email Validation on Invite Form
**Status:** Bug Fix | **Complexity:** Low
**Broken file:** `components/InviteUserPanel.tsx`

| Task | Time |
|---|---|
| Add RFC-compliant email regex validation | 30 min |
| Show inline error message below field | 15 min |
| Disable submit button until email is valid | 15 min |
| **Subtotal** | **1 h** |

---

## 4.6 Export Error Surface to User
**Status:** Bug Fix | **Complexity:** Low
**Broken files:** `services/pdfExportService.ts`, `services/excelExportService.ts`

Export failures are silently swallowed — the button just stops responding.

| Task | Time |
|---|---|
| Wrap PDF export in try-catch and show toast with error detail | 30 min |
| Wrap Excel export in try-catch and show toast with error detail | 30 min |
| Add "retry" option to export error toast | 30 min |
| **Subtotal** | **1 h 30 min** |

---

## 4.7 IndexedDB Fallback for Private Browsing
**Status:** Bug Fix | **Complexity:** Low
**Broken file:** `utils/uploadPersistence.ts`

| Task | Time |
|---|---|
| Wrap all IndexedDB usage in try-catch | 30 min |
| Implement in-memory fallback storage | 30 min |
| Show notification to user when running in private mode | 15 min |
| **Subtotal** | **1 h 15 min** |

---

## 4.8 Integrate SkeletonLoader
**Status:** UX Fix | **Complexity:** Low
**Broken files:** `views/DatabaseView.tsx`, `components/DoorScheduleManager.tsx`

`SkeletonLoader` component exists but is never used.

| Task | Time |
|---|---|
| Integrate SkeletonLoader into `DatabaseView` loading state | 45 min |
| Integrate SkeletonLoader into `DoorScheduleManager` loading state | 45 min |
| **Subtotal** | **1 h 30 min** |

**Phase 4 Total: ~21 hours**

---

---

# PHASE 5 — Architecture & Testing

---

## 5.1 Extract Business Logic from Components
**Status:** Refactor | **Complexity:** High
**Broken files:** `views/ProjectView.tsx`, `components/DoorScheduleManager.tsx`, `components/HardwareSetsManager.tsx`

| Task | Time |
|---|---|
| Extract pricing logic from `ProjectView.tsx` → `services/pricingService.ts` | 2 h |
| Extract schedule calculation logic from `DoorScheduleManager.tsx` → custom hook `useDoorSchedule` | 2 h 30 min |
| Extract hardware set validation from `HardwareSetsManager.tsx` → `services/hardwareValidationService.ts` | 1 h 30 min |
| Update components to call services/hooks (no logic inline) | 1 h |
| Verify UI still works after extraction | 1 h |
| **Subtotal** | **8 h** |

---

## 5.2 Unit Tests — Service Layer
**Status:** New Infrastructure | **Complexity:** High

| Task | Time |
|---|---|
| Set up test fixtures and mock data | 1 h |
| Tests for `pricingService.ts` (markup, margin, totals) | 2 h |
| Tests for `csvParser.ts` (header mapping, BOM handling, edge cases) | 1 h 30 min |
| Tests for `xlsxParser.ts` (header detection, unit conversion) | 1 h 30 min |
| Tests for `pdfParser.ts` (text extraction, page batching) | 1 h |
| Tests for `doorValidation.ts` (required fields, fire rating checks) | 2 h |
| Tests for `fileUploadService.ts` (validation logic) | 1 h |
| Tests for ID standardization (no collisions) | 30 min |
| **Subtotal** | **10 h 30 min** |

---

## 5.3 Unit Tests — PDF Pipeline Architecture
**Status:** New Infrastructure | **Complexity:** Medium

| Task | Time |
|---|---|
| Tests for page relevance classifier (2.1) with sample PDF text | 1 h |
| Tests for `AsyncQueue` concurrency behaviour | 1 h |
| Tests for chunk boundary stitching (2.3) — verify no data loss at seams | 1 h 30 min |
| Tests for checkpoint/resume (2.4) — IndexedDB mock | 1 h |
| Tests for vision fallback trigger logic (2.8) | 30 min |
| **Subtotal** | **5 h** |

---

## 5.4 Integration Tests — Critical User Flows
**Status:** New Infrastructure | **Complexity:** Medium

| Task | Time |
|---|---|
| Integration test: Login → Create Project → Upload File → View Schedule | 2 h |
| Integration test: Upload 50-page PDF → chunked extraction → full schedule | 1 h 30 min |
| Integration test: Upload scanned PDF → vision fallback triggered | 1 h |
| Integration test: Export to PDF → file is downloaded correctly | 1 h |
| Integration test: Export to Excel → file is downloaded correctly | 1 h |
| **Subtotal** | **6 h 30 min** |

---

## 5.5 Error Boundary Improvements
**Status:** Reliability | **Complexity:** Low
**File:** `components/ErrorBoundary.tsx`

| Task | Time |
|---|---|
| Add specific error messages per error type | 30 min |
| Add "Copy Error Details" button for user to share with support | 30 min |
| Log errors to Supabase error logging table | 45 min |
| **Subtotal** | **1 h 45 min** |

**Phase 5 Total: ~32 hours**

*(Reduced from original 38h because Phase 2.x is a ground-up rebuild that builds in more testability from the start. Testing a clean architecture is faster than testing hacked-together code.)*

---

---

# PHASE 6 — UX & Reliability Polish

---

## 6.1 Collaborative Real-Time Sync
**Status:** New Feature | **Complexity:** Medium
*Enabled automatically once Supabase migration (Phase 1.3) is complete.*

| Task | Time |
|---|---|
| Subscribe to Supabase real-time on active project | 1 h |
| Show "User X is editing door Y" indicator | 1 h 30 min |
| Basic conflict detection (optimistic lock on row edits) | 1 h 30 min |
| **Subtotal** | **4 h** |

---

## 6.2 Improved Empty States
**Status:** UX | **Complexity:** Low

| Task | Time |
|---|---|
| Empty state for Dashboard (no projects yet) with quick-start CTA | 45 min |
| Empty state for Door Schedule (no doors yet) with upload CTA | 30 min |
| Empty state for Database (no inventory yet) | 30 min |
| **Subtotal** | **1 h 45 min** |

---

## 6.3 Keyboard Shortcuts Documentation
**Status:** UX | **Complexity:** Low
**File:** `hooks/useKeyboardShortcuts.ts`

Keyboard shortcuts are implemented but not discoverable.

| Task | Time |
|---|---|
| Build keyboard shortcut help modal (? key to open) | 1 h |
| List all shortcuts with their descriptions | 30 min |
| **Subtotal** | **1 h 30 min** |

---

## 6.4 Data Export Improvements
**Status:** UX | **Complexity:** Low

| Task | Time |
|---|---|
| Add export preview (show first 5 rows before downloading) | 1 h |
| Remember last used export settings per user | 30 min |
| Add COBie export to main export menu (currently hidden) | 30 min |
| **Subtotal** | **2 h** |

---

## 6.5 Mobile Responsiveness Audit
**Status:** UX | **Complexity:** Medium

| Task | Time |
|---|---|
| Audit all views for mobile breakpoints | 1 h |
| Fix DoorScheduleManager table horizontal scrolling on mobile | 1 h |
| Fix modal sizing on small screens | 45 min |
| **Subtotal** | **2 h 45 min** |

**Phase 6 Total: ~12 hours**

---

---

# FINAL SUMMARY TABLE

## By Phase

| Phase | Description | Hours |
|---|---|---|
| Phase 0 | Project Setup & Environment | 9 h |
| Phase 1 | Security & Authentication | 53 h |
| Phase 2 | AI PDF Pipeline — Architecture Overhaul | 57 h |
| Phase 3 | Performance Fixes | 19 h |
| Phase 4 | Code Quality & TypeScript | 21 h |
| Phase 5 | Architecture & Testing | 32 h |
| Phase 6 | UX & Reliability | 12 h |
| **GRAND TOTAL** | | **203 hours** |

---

## By Work Type

| Type | Hours | % of Total |
|---|---|---|
| Critical Bug Fixes (Auth, Security, Data) | 53 h | 26% |
| Architecture Overhaul (PDF Pipeline) | 57 h | 28% |
| Refactoring & Code Quality | 31 h | 15% |
| Performance Optimization | 19 h | 9% |
| Testing (unit + integration) | 22 h | 11% |
| UX & Reliability | 12 h | 6% |
| Infrastructure & Setup | 9 h | 4% |

---

## By Priority

| Priority | Tasks | Hours |
|---|---|---|
| P0 — Must ship before any real users | Auth, API key security, DB migration | 53 h |
| P1 — Core feature rebuild | PDF pipeline architecture overhaul | 57 h |
| P2 — Ship before scaling | Performance, code quality, architecture | 71 h |
| P3 — Polish | Testing, UX, reliability | 22 h |

---

## Suggested Sprint Order

| Sprint | Focus | Deliverable | Hours |
|---|---|---|---|
| Sprint 1 (Week 1–2) | Phase 0 + Phase 1.1–1.4 | Real auth, API key proxy (also unblocks Phase 2), DB migration | 43 h |
| Sprint 2 (Week 3) | Phase 2.1–2.5 | PDF pipeline architecture: triage, parallel queue, stitching, fix double-chunking | 31 h |
| Sprint 3 (Week 4) | Phase 2.6–2.10 + Phase 1.5–1.6 | JSON repair fix, worker pool, vision fallback, Excel catalog, team invites | 32 h |
| Sprint 4 (Week 5) | Phase 3 + Phase 4 | Performance + code quality | 40 h |
| Sprint 5 (Week 6) | Phase 5 + Phase 6 | Testing + UX polish | 44 h |
| **Total** | | | **190 h** |

*(Remaining ~13h is buffer for QA, edge cases, and integration issues that always arise.)*

---

## Important Notes

1. **Phase 1.2 (API proxy) must be done before Phase 2.2 (parallel queue).** The parallel queue only makes sense if AI calls go through a server-side proxy with higher rate limits. Client-side calls to Gemini/OpenRouter have strict browser rate limits that parallel calls will hit immediately.

2. **The PDF pipeline (Phase 2) is a ground-up architecture rewrite, not a feature addition.** The UI, types, validation, and prompts are all being kept. What changes is the orchestration layer: how pages are classified, how chunks are queued, how results are stitched together. Expect 1–2 days of integration debugging even after the units are complete.

3. **Vision fallback (2.8) is a significant multiplier on API costs.** Each page rendered as an image costs roughly 10–20x more in tokens than text extraction. Gate this behind an explicit user setting ("Allow vision mode for scanned pages") and warn about cost before enabling.

4. **The original Phase 2 estimate assumed the pipeline was built from scratch.** The revised estimate assumes the current code is the starting point. If the decision is made to completely discard the existing code (clean slate), add ~15h for rewriting the parts that already work (parser, schemas, basic extraction flow).

5. **Supabase Edge Functions** (needed for Phase 1.2 and Phase 2.2) require familiarity with Deno. Add ~4h if the developer has not worked with Supabase Edge Functions before.

---

*This document was updated after a full re-analysis of: `pdfParser.ts`, `geminiService.ts`, `fileUploadService.ts`, `upload.worker.ts`, `aiProviderService.ts`, `ImageAnalysisModal.tsx`, and the original CODE_AUDIT_REPORT.md.*
