# Testing

**Analysis Date:** 2026-05-06

## Headline

The codebase has **no automated tests**. Testing libraries are installed but
unwired. CI does not run tests. The "testing" target is Phase 5–6 in the
working-hours plan, deliberately deferred behind security, schema, and pipeline
work.

This document records that state honestly so future work doesn't assume coverage
that doesn't exist.

## Installed Test Tooling (`package.json`)

| Package | Version | Status |
|---|---|---|
| `@testing-library/react` | ^16.3.2 | Installed, unused |
| `@testing-library/jest-dom` | ^6.9.1 | Installed, unused |
| Vitest | not installed | — |
| Jest | not installed | — |
| Playwright / Cypress | not installed | — |
| MSW (Mock Service Worker) | not installed | — |

There is **no test runner** in `package.json` `scripts`. Available scripts:
`dev`, `build`, `start`, `lint`. None of them executes tests.

## Test Files

**Source-tree test files:** zero.
- No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` exist outside
  `node_modules/`.
- No `__tests__/` directories.
- No `tests/` or `e2e/` top-level folder.

**Fixtures present:** sample data files at the repo root (`pdf_example.json`,
`door_schedule_excel_sheet.json`, `final-json-format.json`, `metadata.json`)
and `debug-extractions/`. These look like ad-hoc snapshots from manual
extraction runs; they are not used by an automated test.

**The closest thing to a test:** `scripts/test-merge.ts` — a `tsx`-runnable
script for manually exercising `services/mergeService.ts`. It is not a unit
test; it is a developer harness.

## Test Configuration

- No `vitest.config.ts` / `vite.config.test.ts`.
- No `jest.config.ts` / `jest.config.js`.
- No `setupTests.ts` / `vitest.setup.ts`.
- `tsconfig.json` does not include or exclude any `*.test.*` pattern (because
  there are none).

## CI / Automation

- No `.github/workflows/` directory.
- No CI pipeline in the repo. Builds and lint are not enforced on push or pull
  request via repo-side automation.

## Mocking & Fixtures

- No mock factories.
- No HTTP-mocking layer (MSW, nock, etc.).
- AI/Supabase clients are instantiated directly — to test them you would need
  to add a mocking strategy.
- Sample PDFs, JSON, and Excel files exist in `debug-extractions/` and at the
  repo root and could be re-purposed as integration-test fixtures.

## Coverage

Untracked. There is nothing to measure. When testing is wired up, every file
listed in CONCERNS.md as "high-risk extraction logic" should have ≥1 unit test
before its parent phase ships.

## What Would Need a Test First (Risk-Ordered Backlog)

These are the highest-leverage targets for the eventual Phase 5–6 testing push.
Each is currently completely untested and is critical-path:

1. **`utils/pdfParser.ts`** — `extractTextGenerator` async generator. Smallest,
   purest module with the highest blast radius. Should be the first unit test.
2. **`services/geminiService.ts:safeParseJson`** — JSON-repair heuristics around
   AI output. Easy to test with recorded LLM responses.
3. **`services/fileUploadService.ts:validateDoors` / `validateHardwareSets`** —
   ValidationReport pattern; test with crafted bad input.
4. **`utils/doorValidation.ts`** — pure validation rules.
5. **`utils/csvParser.ts`, `utils/xlsxParser.ts`, `utils/docxParser.ts`** — file
   import paths; test against fixtures in `debug-extractions/`.
6. **`lib/auth/rbac.ts`** — `canAccessRoute` truth table. Pure function, trivial
   to cover.
7. **`app/api/ai/generate/route.ts`** — server proxy. Integration test with the
   AI clients mocked.
8. **`contexts/ProjectContext.tsx`** — state-management contract; React
   Testing Library + a Supabase mock.
9. **`services/pricingService.ts`, `services/pricingReportService.ts`** —
   numerical correctness; deserves property-style tests.
10. **`workers/upload.worker.ts`** — message protocol with the main thread.

## Recommended Setup (When Testing Phase Begins)

When this is wired up, the lowest-friction stack for this codebase is:

- **Vitest** as the runner (Vite-aligned, fast, native ESM, works out of the
  box with TypeScript and the existing Next.js project).
- **React Testing Library** + **`@testing-library/jest-dom`** (already installed)
  for component tests.
- **MSW** for HTTP/Supabase mocking at the network boundary.
- **Co-located** `*.test.ts(x)` files next to the unit they cover.
- **`vitest.config.ts`** with `environment: 'jsdom'` for component tests and
  `node` for service/utility tests.
- **`vitest.setup.ts`** that imports `@testing-library/jest-dom`.
- Add `"test": "vitest"`, `"test:run": "vitest run"`, `"test:coverage":
  "vitest run --coverage"` to `package.json` scripts.
- A GitHub Actions workflow (`.github/workflows/test.yml`) that runs
  `npm run test:run` on PRs.

## Manual Verification Today

Until automated testing exists, every change is verified by:
- Running `npm run dev` (Next.js dev server with Turbopack on port 3000).
- Manual click-through in the browser.
- Sample PDFs in `debug-extractions/` for the extraction pipeline.
- `scripts/test-merge.ts` for merge logic.

This is fragile and is the load-bearing assumption that makes Phase 5–6
necessary.

---

*Testing analysis: 2026-05-06*
