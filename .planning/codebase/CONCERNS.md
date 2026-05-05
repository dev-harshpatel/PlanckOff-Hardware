# Concerns

**Analysis Date:** 2026-05-06

This document records technical debt, security risks, fragile areas, and gaps
that should inform planning. Severity levels: **CRITICAL** (must fix before
shipping further user-facing changes), **HIGH** (fix in current milestone),
**MEDIUM** (next milestone), **LOW** (backlog).

> Note on CLAUDE.md drift: the migration to Next.js + a server-side AI proxy is
> further along than CLAUDE.md suggests. Several "active constraints" in
> CLAUDE.md are partially or fully resolved. This document distinguishes
> resolved-but-still-claimed from genuinely-open issues.

---

## CRITICAL

### C1. Legacy client-side Gemini fallback still in code

**Where:** `services/geminiService.ts:265`

```ts
const key = apiKey || process.env.VITE_GEMINI_API_KEY;
```

**Why it matters:** the codebase added a server-side AI proxy
(`app/api/ai/generate/route.ts`) that correctly reads `GEMINI_API_KEY` /
`OPENROUTER_API_KEY` server-only. But this client path still falls back to a
`VITE_*` variable, which Vite/Next bundlers expose to the browser if it ends
up in the runtime environment. Any code path that still calls the client-side
Gemini helper undermines the proxy.

**Remediation:**
1. Remove the `process.env.VITE_GEMINI_API_KEY` fallback.
2. Ensure every caller of the helper goes through `/api/ai/generate` instead.
3. Grep for `VITE_` across the source tree on every PR until it returns zero.
4. Rotate the affected Gemini key (assume it has been exposed in client bundles
   historically).

### C2. RLS policy verification on Supabase tables

**Where:** `supabase/migrations/*.sql`

**Why it matters:** the API surface uses Supabase via `lib/db/*.ts` and
`lib/supabase/admin.ts`. If row-level security policies are absent or
permissive on user-data tables, a leaked anon key (or a `lib/db` bug that
calls the admin client where it should use the user client) can read or
mutate data across tenants.

**Remediation:**
1. Audit every migration file for `ENABLE ROW LEVEL SECURITY` plus an explicit
   `CREATE POLICY` per role.
2. Verify that `lib/supabase/admin.ts` (service role) is only called from
   server contexts where RBAC has already been checked.
3. Add a recurring check: any new table migration must include RLS in the same
   file.

---

## HIGH

### H1. localStorage still used for project / inventory / settings data

**Where:**
- `contexts/ProjectContext.tsx` — master inventory and app settings keys
- `contexts/BackgroundUploadContext.tsx` — upload state
- `services/aiProviderService.ts`, `services/mlOpsService.ts` — provider config
- `components/DoorScheduleManager.tsx`, `components/ResizablePanels.tsx`,
  `components/ExportConfigModal.tsx` — UI persistence

**Why it matters:** no cross-device sync, no per-user isolation, no encryption
of pricing/customer-adjacent data, lost on browser data wipes. Phase 1.3 is
explicitly about this migration.

**Remediation:** route every read/write through `lib/db/*.ts`. UI-preference
state can stay in localStorage if it's purely cosmetic; anything resembling
business data must move.

### H2. PDF pipeline is sequential (`CONCURRENCY = 1`)

**Where:** `services/geminiService.ts` (extraction loops), supported by
`utils/pdfParser.ts:extractTextGenerator` and `services/fileUploadService.ts`.

**Why it matters:** large door schedules (>200 pages) take linear-in-page-count
wall-clock time. Users experience the app as broken on real-world PDFs.

**Remediation:** introduce a worker-pool / promise-pool around the generator
output (target concurrency 5–10 with backpressure based on Gemini rate
limits). This is the Phase 2 architectural rewrite.

### H3. Single Web Worker, no pool

**Where:** `workers/upload.worker.ts` (69 lines, single instance).

**Why it matters:** one worker thread serialises all uploads. Even multi-file
uploads bottleneck on it.

**Remediation:** worker pool (3–5 workers) with a task queue. Pairs naturally
with H2.

### H4. Oversized files violating the <300-line rule

| File | Lines | Notes |
|---|---|---|
| `views/ProjectView.tsx` | 2104 | composition root for the workspace; needs decomposition into sub-views |
| `components/PricingReportConfig.tsx` | 2061 | UI + report-building logic mixed |
| `services/geminiService.ts` | 771 | extraction orchestration + JSON repair + image analysis |
| `types.ts` | 742 | already partially split into `types/`; complete the split |
| `services/fileUploadService.ts` | 337 | borderline; extract validation helpers |

**Remediation:** split each by domain area; extract pure logic into utils.
Track per-file size as part of plan-phase verification.

### H5. 119 `any` types across 28 files

**Where:** worst offenders — `services/cobieExportService.ts` (18),
`utils/xlsxParser.ts` (17), `services/excelExportService.ts` (10),
`components/ReportDataPreview.tsx` (9), `services/geminiService.ts` (8),
`services/pdfExportService.ts` (7), `types.ts` (6).

**Why it matters:** `tsconfig.json` keeps `strict: false` because of these.
Until they're paid down, the type system isn't actually catching anything.

**Remediation:** convert to `unknown` + narrowing, file by file. Re-enable
`"strict": true` once the count is zero. Add a CI step that fails on new
`: any` introductions.

### H6. Image-analysis path bypasses server proxy

**Where:** `services/geminiService.ts:analyzeImageWithAI` (around line 260+).

**Why it matters:** unlike the text-extraction path (which now goes through
`/api/ai/generate`), the image-analysis helper still calls Gemini directly
from the client. This is the entry point that consumes the C1 leaked key.

**Remediation:** add a server route (e.g. `app/api/ai/image-analyze/route.ts`)
and make `analyzeImageWithAI` POST to it. Same shape as
`app/api/ai/generate/route.ts`.

---

## MEDIUM

### M1. Hardcoded Tailwind color classes (dark-mode token rule violations)

**Where:** ~305 hits across 26 files in `components/`, `views/`, `app/`.
Notable: `components/ImageAnalysisModal.tsx`,
`components/PricingReportConfig.tsx`, `components/HardwareSetsManager.tsx`,
`components/EstimationReport.tsx`, `components/ReportDataPreview.tsx`,
`components/SubmittalCoverPage.tsx`, `views/TeamManagement.tsx`.

**Why it matters:** dark mode breaks visually on these surfaces. The CLAUDE.md
rule explicitly forbids `bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`,
`bg-red-50`, `bg-green-50`. They are present anyway.

**Remediation:** sweep file-by-file, replacing with token form
(`bg-[var(--bg)]`, `text-[var(--text)]`, etc., or explicit `dark:` variants
for semantic colors). Add a lint rule (custom ESLint or a CI grep) to prevent
new violations.

### M2. 173 unguarded `console.{log,error,warn}` calls

**Where:** across `.ts`/`.tsx` source files.

**Why it matters:** internal state and (occasionally) sensitive identifiers
leak to the user's DevTools console. There is no environment guard.

**Remediation:** introduce a small `lib/logger.ts` with levels
(`debug`/`info`/`warn`/`error`) that no-ops `debug`/`info` outside development.
Migrate calls. Strip the rest.

### M3. 10 MB upload size cap

**Where:** the upload pipeline rejects files past ~10 MB (referenced in
CLAUDE.md and the file-upload service). Real construction PDFs frequently
exceed this.

**Remediation:** chunked / streaming upload with a higher hard cap (50 MB+),
plus server-side size validation. Pairs with H2/H3.

### M4. Mixed export styles for components

**Where:** older components default-export (`components/Header.tsx`,
`components/PricingReportConfig.tsx`, …); newer ones use named exports.

**Why it matters:** inconsistency hurts grep/refactor and contradicts the
stated rule.

**Remediation:** flip to named exports during the next sweep of each file.

### M5. Business logic in components

**Where:** `components/ImageAnalysisModal.tsx`, `components/DoorScheduleManager.tsx`,
`components/PricingReportConfig.tsx` contain transform / extraction logic
that belongs in services.

**Remediation:** extract to `services/` or feature hooks; keep components
focused on rendering and event wiring.

### M6. Two co-existing PDF service implementations

**Where:** `services/hardwarePdfService.ts` and `services/hardwarePdfServiceV2.ts`.

**Why it matters:** unclear which is canonical; risk of bug-fixes landing on
the wrong one.

**Remediation:** identify the live one, deprecate or delete the other, leave
a one-line note.

### M7. Orphaned working file

**Where:** `components/HardwareSetsManager_fix.txt` lives next to
`components/HardwareSetsManager.tsx`.

**Remediation:** delete after confirming the fix has been applied; nothing
should ship with `*_fix.txt` working files.

### M8. Excluded-but-still-present legacy entry points

**Where:** `App.tsx`, `index.tsx`, `views/ReportsViewWrapper.tsx` are excluded
from `tsconfig.json` (`exclude: [...]`) — leftover Vite entry points.

**Remediation:** delete after confirming nothing references them. They
currently sit in the repo, untyped and untested.

### M9. Realtime subscription cleanup

**Where:** `hooks/useProjectRealtime.ts`, `contexts/ProjectContext.tsx`.

**Why it matters:** Supabase realtime channels need explicit unsubscribe in
useEffect cleanup. Leaks on route change/unmount cause memory growth and
duplicate-event delivery.

**Remediation:** verify every `.subscribe()` has a paired `.unsubscribe()` in
the cleanup return.

### M10. Environment variable validation

**Where:** scattered `process.env.X` reads with `?? ''` style fallbacks.

**Why it matters:** the server starts even if a required key is missing;
failure surfaces at runtime as a confusing 500.

**Remediation:** a single `lib/config.ts` that fails fast on startup if any
required key is missing. Throw at module load.

---

## LOW

### L1. No unit/E2E tests at all

**Where:** entire codebase. See `TESTING.md` for the full picture.

**Why it matters:** every release ships untested logic. Regression risk on
every refactor.

**Remediation:** Phase 5–6. Wire Vitest, start with `utils/pdfParser.ts` and
`lib/auth/rbac.ts`.

### L2. Sparse JSDoc on exported services

**Where:** most service-layer functions.

**Remediation:** when touching a file, add a one-paragraph JSDoc on each
exported function. Don't backfill in a separate PR.

### L3. Repo-root fixture clutter

**Where:** `metadata.json`, `prompt.txt`, `pdf_example.json`,
`door_schedule_excel_sheet.json`, `final-json-format.json`,
`debug-extractions/`.

**Remediation:** move under `docs/fixtures/` or `tests/fixtures/` once Phase
5 introduces a tests folder.

### L4. CLAUDE.md drift

**Where:** `CLAUDE.md`.

**Why it matters:** several constraints (auth stub, AI key in client bundle,
ProjectContext at 1000+ lines) are out of date. New sessions are briefed with
stale information and may make incorrect assumptions.

**Remediation:** sync `CLAUDE.md` to current reality once this codebase map
is reviewed.

### L5. No data retention / GDPR posture

**Where:** soft-delete via "trash" exists for projects, but no permanent
deletion policy or data-export endpoint.

**Remediation:** when going to production with real customer data, add a
retention policy and a data-export route.

---

## Resolved (in code, but still claimed in CLAUDE.md)

These appear in CLAUDE.md as open issues; the code shows them fixed. Update
the doc.

- **Auth is a stub / `logout()` sets `isAuthenticated = true`** — the current
  `contexts/AuthContext.tsx:76-84` calls `/api/auth/logout`, sets `user` to
  `null`, redirects to `/login`. `isAuthenticated` is now derived from
  `user !== null`. The bug as described is gone.
- **All AI calls hit Gemini directly from client** — text-generation goes
  through `app/api/ai/generate/route.ts` with server-side keys. (The leftover
  client path is the C1/H6 entries above; the architecture is correct.)
- **`ProjectContext.tsx` is 1000+ lines** — it's 243 lines today.

---

## Phase Dependency Map

| Concern | Severity | Phase |
|---|---|---|
| C1 (legacy VITE_ fallback) | CRITICAL | 1.1 — security |
| C2 (RLS audit) | CRITICAL | 1.2 — auth/data |
| H1 (localStorage migration) | HIGH | 1.3 — data |
| H2/H3 (PDF concurrency, worker pool) | HIGH | 2 — pipeline |
| H4 (oversized files) | HIGH | 3 — code quality |
| H5 (`any` paydown) | HIGH | 3 — code quality |
| H6 (image-analyze proxy) | HIGH | 1.1 — security |
| M1–M10 | MEDIUM | 3–4 — quality + perf |
| L1 (testing) | LOW | 5–6 |
| L2–L5 | LOW | rolling |

---

*Concerns analysis: 2026-05-06*
