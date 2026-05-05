# Code Conventions

**Analysis Date:** 2026-05-06

## Code Style

**Language:** TypeScript 5.8 (strict mode currently disabled per `tsconfig.json:31` —
re-enable target is the code-quality phase).

**Module system:** ES Modules. Bundler resolution (`moduleResolution: bundler`) for
Next.js 15 compatibility.

**Path alias:** `@/*` → repo root.

**Formatting:**
- No `.prettierrc`, no `.eslintrc` checked in (only `next lint` available via the
  default Next.js ESLint preset). Style is enforced by convention rather than tooling.
- Indentation: 2 spaces in JSX, 2 spaces in most TS — consistent across recent files.
- Quotes: single quotes in TS (`'use client';`, imports) — see `contexts/AuthContext.tsx`.
- Semicolons: present.
- Trailing commas: present in multi-line objects.

## Naming

| Asset | Pattern | Examples |
|---|---|---|
| Component files | `PascalCase.tsx` | `Header.tsx`, `HardwareSetModal.tsx` |
| Components | `PascalCase` named export *(see exceptions below)* | `Header`, `AppShell` |
| Service files | `camelCaseService.ts` | `geminiService.ts`, `pricingService.ts` |
| Service functions | `camelCase` | `extractFromPdf`, `generatePricingReport` |
| Hooks | `useCamelCase` | `useRBAC`, `useKeyboardShortcuts` |
| Context | `<Domain>Context` + `use<Domain>` hook | `AuthContext` + `useAuth` |
| Types/interfaces | `PascalCase` | `Door`, `HardwareSet`, `AuthUser` |
| Constants | `UPPER_SNAKE_CASE` | `SESSION_COOKIE_NAME`, `ROLE_LEVELS`, `ROUTE_PERMISSIONS` |
| Booleans | `is*` / `has*` / `can*` / `should*` | `isAuthenticated`, `isLoading`, `canAccessRoute` |
| Event handlers | `handle*` | `handleSave`, `handleAnalyze` |
| Event-handler props | `on*` | `onSelectProject`, `onClose` |
| API route segments | Next.js convention: `route.ts` | `app/api/auth/login/route.ts` |
| Workers | `<name>.worker.ts` | `workers/upload.worker.ts` |

## Module / Export Patterns

**Stated rule (CLAUDE.md):** named exports only for components.

**Actual state (mixed):**
- New / migrated files use named exports — e.g. `contexts/AuthContext.tsx` exports
  `AuthProvider`, `useAuth`, `useCurrentUser`.
- Older components still use `export default` (e.g. `components/Header.tsx`,
  `components/PricingReportConfig.tsx`). This is a remediation backlog item.
- Services consistently use named exports.

**Side-effect-free modules:** services and utilities avoid module-level work
(no top-level fetches, no IIFE setup).

## TypeScript Patterns

**Strictness:** `strict: false` in `tsconfig.json` during the migration. The intent
is to flip it back on once `any` usage is paid down (see CONCERNS.md).

**Forbidden by convention but present in code:** `: any` and `as any`.
- 119 occurrences across 28 files.
- Worst offenders by count: `services/cobieExportService.ts` (18), `utils/xlsxParser.ts`
  (17), `services/excelExportService.ts` (10), `components/ReportDataPreview.tsx` (9),
  `services/geminiService.ts` (8), `services/pdfExportService.ts` (7), `types.ts` (6).

**Preferred:** `unknown` + narrowing type guard.
```ts
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
}
```
Pattern is consistent in newer code (`app/api/ai/generate/route.ts`,
`contexts/AuthContext.tsx`).

**Domain types:** `types.ts` (742 lines) is the legacy monolith. New domain
splits live under `types/` (`types/auth.ts`, `types/team.ts`).

## Imports

**Order observed in newer files:**
1. React / Next.js (`react`, `next/navigation`, `next/server`)
2. Third-party libraries (`openai`, `@google/genai`, `@supabase/*`)
3. Internal absolute (`@/lib/*`, `@/services/*`, `@/types/*`)
4. Relative (`./helpers`, `../foo`)

**Type-only imports** use `import type { … }` consistently (e.g. `import type {
AuthUser, RoleName } from '@/types/auth'`).

**`'use client'` directive** is present at the top of client components and
contexts that touch the browser API surface (`contexts/AuthContext.tsx:1`,
`app/providers.tsx`).

## Error Handling

**API routes** (`app/api/*/route.ts`): try/catch, narrow with `instanceof Error`,
return `NextResponse.json({ error }, { status })`. See
`app/api/ai/generate/route.ts:107-109`.

**Client fetches** (contexts, components): catch + surface via toast
(`addToast(message, 'error')`); fail-soft hydration in `AuthContext.tsx:41-45`.

**Services / extraction** (`services/geminiService.ts`,
`services/fileUploadService.ts`): `ValidationReport<T> = { data, errors[],
warnings[], summary }` pattern. Errors are returned, not thrown.

**Retry pattern** (AI calls, both providers): exponential backoff
`1000 * 2 ** attempt` with `maxRetries = 5`. Same pattern in
`generateWithOpenRouter` and `generateWithGemini` in `app/api/ai/generate/route.ts`.

**Boundaries:** `components/ErrorBoundary.tsx` catches render-time errors;
`components/ErrorModal.tsx` displays critical errors.

## Logging

- Uses `console.log`, `console.error`, `console.warn` directly. No structured
  logger.
- 173 console statements across `.ts`/`.tsx` source files (excluding
  `node_modules`).
- No environment guard — these run in production builds. CONCERNS.md flags this
  for cleanup.
- Some services prefix log lines with a tag (e.g. `[geminiService]`); not enforced.

## Async Patterns

- `async`/`await` everywhere. No callback-style code in newer modules.
- Promise concurrency: mostly `await` in sequence. The PDF pipeline uses an
  async generator (`utils/pdfParser.ts:extractTextGenerator`) that yields page
  batches — but its consumer in `services/geminiService.ts` runs with
  `CONCURRENCY = 1`.

## Styling

**Tailwind:** local install (3.4), configured via `tailwind.config.ts` and
`postcss.config.js`. Dark mode is the central theming concern.

**Stated rule (CLAUDE.md):** never use hardcoded Tailwind color classes
(`bg-white`, `bg-gray-*`, `text-gray-*`, `border-gray-*`, `bg-red-50`,
`bg-green-50`, etc.). Always use CSS-variable tokens:
- Backgrounds: `bg-[var(--bg)]`, `bg-[var(--bg-muted)]`, `bg-[var(--bg-subtle)]`
- Text: `text-[var(--text)]`, `text-[var(--text-secondary)]`, `text-[var(--text-muted)]`
- Borders: `border-[var(--border)]`
- Semantic colors (success/warning/error): explicit dark variants
  (`text-amber-600 dark:text-amber-400`).

**Actual state:** ~305 hardcoded color-class hits across 26 component files.
Notable offenders include `ImageAnalysisModal.tsx`, `PricingReportConfig.tsx`,
`HardwareSetsManager.tsx`, `EstimationReport.tsx`, `ReportDataPreview.tsx`,
`SubmittalCoverPage.tsx`, `views/TeamManagement.tsx`. CONCERNS.md tracks this
as a sweep target.

**`next-themes`** drives the `dark` class; tokens in `app/globals.css` switch
based on theme.

## Architecture Discipline

**Stated rule:** Presentation → Application → Domain/Service → Infrastructure.
No upward imports.

**Observed violations:**
- Some components import services directly *and* render UI — acceptable when the
  service is read-only.
- A handful of components contain extraction/transform logic that should live in
  services (e.g. parts of `components/PricingReportConfig.tsx`,
  `components/DoorScheduleManager.tsx`, `components/ImageAnalysisModal.tsx`).
- No component has been observed importing from `lib/db/*` directly — the
  client → API-route boundary is respected.

**Component size rule:** components <300 lines or split. Significant violations:
- `views/ProjectView.tsx` — 2104 lines
- `components/PricingReportConfig.tsx` — 2061 lines
- `services/geminiService.ts` — 771 lines (a service, but still oversized)
- `types.ts` — 742 lines (intended for split)

## Comments and Documentation

- Sparse JSDoc. Most exported functions are not annotated.
- Section banners (`// ---- ----`) are common in larger files (see
  `contexts/AuthContext.tsx`).
- TODO/FIXME density: very low (only one real `TODO` found —
  `constants/inventory.ts:5` — flagging the Supabase migration follow-up).
- README is short; richer per-area docs live in `docs/`.

## Data Persistence

**Stated rule (CLAUDE.md):** no new `localStorage` reads/writes — route through
Supabase.

**Actual state:** 12 files still use `localStorage.{getItem,setItem,removeItem}`,
including `contexts/ProjectContext.tsx`, `contexts/BackgroundUploadContext.tsx`,
`services/aiProviderService.ts`, `services/mlOpsService.ts`,
`components/DoorScheduleManager.tsx`, `components/ResizablePanels.tsx`,
`components/ExportConfigModal.tsx`. Migration to Supabase is the Phase 1.3 target.

## Configuration / Secrets

**Server-only secrets:** read from `process.env` without `NEXT_PUBLIC_` prefix
(`GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

**Client-safe values:** `NEXT_PUBLIC_*` (e.g. `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

**Legacy leak (active concern):** `services/geminiService.ts:265` falls back to
`process.env.VITE_GEMINI_API_KEY` if no key is passed in. This path is a
client-side AI call and undermines the otherwise-correct server proxy at
`app/api/ai/generate/route.ts`. See CONCERNS.md.

---

*Conventions analysis: 2026-05-06*
