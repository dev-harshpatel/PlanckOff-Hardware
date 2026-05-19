# Technology Stack: v2.0 File Modularization Refactor

**Project:** PlanckOff Hardware (Next.js 15 / React 19 / TypeScript 5.8.2)
**Researched:** 2026-05-13
**Scope:** Tooling and patterns for safely splitting 5 large files (750-1008 lines each) into focused modules with zero behavior change.

---

## Existing Baseline (What Already Works)

These are confirmed facts from the live codebase — not speculation.

| Item | State |
|------|-------|
| TypeScript 5.8.2 | Installed, `tsc --noEmit` runs, 142 pre-existing errors (all in utils/, not in target files) |
| `isolatedModules: true` | Enforced — every module must be independently transpilable (critical for split correctness) |
| `moduleResolution: "bundler"` | Turbopack/webpack resolve — supports bare specifiers and `@/*` aliases |
| Path alias `@/*` → `./*` | Single alias pointing to project root, used inconsistently (some files use `@/`, others use `../../`) |
| No ESLint config at project root | No `.eslintrc`, no `eslint.config.js` at `F:\PlanckOff-Hardware\` (only in node_modules) |
| No barrel `index.ts` files | None exist in `hooks/`, `services/`, `components/doorSchedule/`, `components/hardware/`, `components/pricing/` |
| `ignoreBuildErrors: true` in next.config.ts | Pre-existing TS errors won't block `next build` — this is intentional, do not change during refactor |
| All report pages are `'use client'` | `app/project/[id]/reports/*/page.tsx` all have `'use client'` directive |
| Target hooks/services have no `'use client'` | `useDoorTableState.tsx` has it; `DoorScheduleConfig.tsx`, `HardwareSetConfig.tsx`, `excelExportService.ts` do NOT |

---

## Primary Verification Tool: TypeScript Compiler

**Why:** `tsc --noEmit` is the authoritative broken-import detector for this codebase. It resolves every `import` statement against actual file paths, applying the `@/*` alias and `moduleResolution: "bundler"` rules. A failed import after a split will surface as `error TS2305` (no exported member) or `error TS2307` (cannot find module) — exactly the errors that already exist for legacy dead code in `utils/`.

**No new runtime libraries are needed for the verification workflow.**

### Import Verification Commands

Run these in `F:\PlanckOff-Hardware\` after each split step.

```powershell
# Step 1: Baseline — capture pre-existing errors before touching anything
npx tsc --noEmit 2>&1 | Select-String "TS2305|TS2307|TS2306" > .planning/tsc-baseline.txt

# Step 2: After each split — compare to baseline
npx tsc --noEmit 2>&1 | Select-String "TS2305|TS2307|TS2306" > .planning/tsc-after.txt
Compare-Object (Get-Content .planning/tsc-baseline.txt) (Get-Content .planning/tsc-after.txt)
```

```bash
# Bash equivalent (also available via Bash tool)
cd "F:/PlanckOff-Hardware"
npx tsc --noEmit 2>&1 | grep "TS2305\|TS2307\|TS2306"
```

**What to look for:** Any new `TS2305` (has no exported member) or `TS2307` (cannot find module) that was not in the baseline is a broken import introduced by the split.

### Targeted File Check

When splitting a specific file, verify only that file's consumers to get faster feedback:

```bash
# After splitting useDoorTableState.tsx
npx tsc --noEmit 2>&1 | grep "useDoorTableState\|DoorTableHeader\|DoorTableRow\|DoorScheduleManager"

# After splitting excelExportService.ts  
npx tsc --noEmit 2>&1 | grep "excelExportService\|ProcurementSummaryView\|ExportConfigModal\|reportExportService"

# After splitting DoorScheduleConfig.tsx
npx tsc --noEmit 2>&1 | grep "DoorScheduleConfig\|excelExportService\|pdfExportService\|csvExportService\|reportExportService"

# After splitting HardwareSetConfig.tsx
npx tsc --noEmit 2>&1 | grep "HardwareSetConfig\|excelExportService\|pdfExportService\|csvExportService\|reportExportService"
```

### Full Consumer Map (Pre-Computed)

| Target File | Direct Importers | Exported Surface Depended On |
|-------------|-----------------|------------------------------|
| `hooks/useDoorTableState.tsx` | DoorTableHeader.tsx, DoorTableRow.tsx, DoorScheduleManager.tsx | `ColumnDef`, `CustomColumn`, `PersistedColumnPrefs`, `StatusFilter`, `formatDimension`, `ALL_AVAILABLE_COLUMNS`, `DOOR_SECTION_KEYS`, `FRAME_SECTION_KEYS`, `HARDWARE_SECTION_KEYS`, `useDoorTableState` |
| `services/excelExportService.ts` | ProcurementSummaryView.tsx, ExportConfigModal.tsx, reportExportService.ts (also: excelTheme.ts false-positive from name match) | `exportDoorScheduleToExcel`, `exportHardwareSetToExcel`, `MultiSheetExportOptions`, `exportMultiSheetWorkbook`, `exportDoorScheduleToPDF` (dead — safe to delete) |
| `components/doorSchedule/DoorScheduleConfig.tsx` | 4 services + 2 app pages + ReportGenerationCenter + ReportsView | `DoorScheduleExportConfig` interface only — plus the default component export |
| `components/hardware/HardwareSetConfig.tsx` | 4 services + 2 app pages + ReportGenerationCenter + ReportsView | `HardwareSetExportConfig` interface only — plus the default component export |
| `components/pricing/PricingReportConfig.tsx` | pricing/page.tsx only | Default component export only |

---

## TypeScript Patterns for Safe Splits

### Pattern 1: Extract Types to a Co-Located Types File First

**Why:** Four services (`excelExportService`, `pdfExportService`, `csvExportService`, `reportExportService`) import `DoorScheduleExportConfig` and `HardwareSetExportConfig` from component files. This creates a components → services dependency inversion that is fragile. Extracting types first decouples the split from import path changes.

**Recommended approach for `DoorScheduleConfig.tsx` and `HardwareSetConfig.tsx`:**

```
Before split:
  services/excelExportService.ts → imports DoorScheduleExportConfig from components/doorSchedule/DoorScheduleConfig.tsx

Step 1: Create components/doorSchedule/doorScheduleTypes.ts (already exists for local types)
        Move DoorScheduleExportConfig INTO it
        
Step 2: Add re-export from DoorScheduleConfig.tsx:
        export type { DoorScheduleExportConfig } from './doorScheduleTypes';

Step 3: tsc --noEmit — must show zero new errors before proceeding

Step 4: Update 4 service files to import from the types file directly
        (or leave them importing from DoorScheduleConfig.tsx — the re-export keeps them working)
```

**Note:** `doorScheduleTypes.ts` already exists at `components/doorSchedule/doorScheduleTypes.ts` and is already imported by `DoorScheduleConfig.tsx`. The type extraction step is partially done.

### Pattern 2: Re-Export from Original Path (Barrel at Original File)

**Why:** When splitting a file that has many consumers, updating all consumer import paths simultaneously is error-prone. The original file can become a thin re-export barrel, updated consumer by consumer over time.

```typescript
// components/doorSchedule/DoorScheduleConfig.tsx (after split — becomes a re-export facade)
export type { DoorScheduleExportConfig } from './doorScheduleTypes';
export { DoorScheduleColumnsPanel } from './DoorScheduleColumnsPanel';
export { DoorSchedulePreviewPanel } from './DoorSchedulePreviewPanel';
export { default } from './DoorScheduleRoot';
```

**When to use:** When more than 3 files import from the target. `DoorScheduleConfig` (9 importers) and `HardwareSetConfig` (8 importers) warrant this approach. `PricingReportConfig` (1 importer) does not — update the consumer directly.

### Pattern 3: Inline Barrel Only for Types, Not for Components

**Why:** Next.js 15 with Turbopack performs tree-shaking at the module level. A barrel that re-exports a `'use client'` component from a non-`'use client'` barrel will cause the entire barrel to be treated as a client boundary. This matters here because:

- `DoorScheduleConfig.tsx` has NO `'use client'` directive
- `HardwareSetConfig.tsx` has NO `'use client'` directive
- `useDoorTableState.tsx` HAS `'use client'`

**Safe pattern:**
```typescript
// hooks/index.ts — DO NOT create this
// Mixing 'use client' hooks with non-client hooks in a barrel forces all consumers
// to treat the barrel as a client module

// INSTEAD: keep direct imports per file
import { useDoorTableState } from '@/hooks/useDoorTableState';  // keeps 'use client' scoped
```

**Rule for this refactor:** Do not create `hooks/index.ts` or `services/index.ts` barrel files. Create `index.ts` only within a component subdirectory where ALL exports share the same client/server boundary.

### Pattern 4: `isolatedModules: true` — Type-Only Imports

**Why:** `isolatedModules: true` is already set. This means every file that imports a type from a split module must use `import type { ... }` (not `import { ... }`) for pure type imports, or TypeScript will error under stricter settings.

Currently `strict: false` masks this, but the pattern should be followed to avoid issues when strict mode is re-enabled:

```typescript
// Correct — type-only import survives isolatedModules
import type { DoorScheduleExportConfig } from './doorScheduleTypes';

// Also correct — value + type mixed import
import { exportDoorScheduleToExcel, type MultiSheetExportOptions } from './doorScheduleExport';
```

**Action:** When extracting types into new files, always use `export type { ... }` for re-exports and `import type { ... }` in consumers.

### Pattern 5: `@/` Alias Consistency

**Why:** The existing codebase uses both `@/components/...` and `../../components/...` inconsistently. During splits, pick one convention per new file and do not mix. The `@/*` alias is safer for sub-module files because it does not break when files move between subdirectory levels.

**Recommended:** Use `@/` for all new split files. Example:
```typescript
// New split file: components/doorSchedule/DoorScheduleColumnsPanel.tsx
import { ColumnDef } from '@/hooks/useDoorTableState';  // preferred over '../../hooks/useDoorTableState'
```

---

## `dependency-cruiser` (Optional, Not Installed)

**Verdict:** Useful for detecting circular imports before splitting, but NOT required for this refactor. `tsc --noEmit` catches broken import paths. The circular import risk is low because the codebase has a clear dependency direction: `app → components → hooks → utils` and `app → services → utils`.

**If wanted, install and run as one-off:**
```bash
npm install --save-dev dependency-cruiser
npx depcruise --include-only "^(hooks|services|components|utils|lib)" --output-type err-long .
```

**Circular import check specific to split targets:**
```bash
npx depcruise --include-only "hooks/useDoorTableState|components/doorSchedule|services/excelExportService" --output-type err-long .
```

**Known risk:** `excelExportService.ts` imports from `components/doorSchedule/DoorScheduleConfig.tsx` (a service importing a component — the inversion noted above). This is the one cross-boundary import that must be resolved before splitting `DoorScheduleConfig`. The type-extraction pattern (Pattern 1) resolves it.

---

## `ts-prune` (Avoid for This Refactor)

**Verdict:** Skip. `ts-prune` is unmaintained (last release 2021, archived in 2023). For this specific refactor — which is a structural split, not dead code removal — it adds noise. Use `tsc --noEmit` and the `grep`-based export audit below instead.

**Dead code that IS confirmed safe to delete** (from PROJECT.md):
- `services/excelExportService.ts` lines 711-902: `exportDoorScheduleToPDF` — unused, no callers. Delete this function from the file as part of the `excelExportService` split. This is not a split risk but a cleanup opportunity.

---

## Next.js 15 Client-Component Constraints

### What Applies to This Refactor

**Constraint 1: `'use client'` directive must be at the top of each file that uses React hooks, browser APIs, or event handlers.**

After splitting `useDoorTableState.tsx` (which has `'use client'`), every new file that uses `useState`, `useEffect`, `useRef`, etc. must carry its own `'use client'` directive. A utility file extracted from it that only exports pure functions or types does NOT need `'use client'`.

Example split of `useDoorTableState.tsx`:
```
hooks/useDoorTableState/
  columnDefinitions.ts        ← no 'use client' (pure data: ALL_AVAILABLE_COLUMNS, ColumnDef types)
  dimensionFormatters.ts      ← no 'use client' (pure functions: formatDimension)
  sectionKeyConstants.ts      ← no 'use client' (pure data: DOOR_SECTION_KEYS etc)
  useDoorTableState.tsx       ← 'use client' (hook with useState, useEffect, useRef)
  index.ts                    ← re-exports all of the above (safe: no mixed client/server boundary issue
                                  because columnDefinitions.ts has no server-only code)
```

**Constraint 2: `serverExternalPackages` in `next.config.ts` covers `jspdf`, `jspdf-autotable`, `xlsx`, `file-saver`.**

These packages are excluded from the server bundle. Any split file that imports them (static or dynamic) must remain in a client-only execution context. Currently:
- `excelExportService.ts` — uses `xlsx` (static import from `xlsx-js-style`) and dynamic `import('jspdf')` / `import('file-saver')` 
- `DoorScheduleConfig.tsx` — uses dynamic `import('xlsx-js-style')`, `import('jszip')`, `import('jspdf')`, `import('jspdf-autotable')`
- `HardwareSetConfig.tsx` — same pattern

When splitting these, keep all dynamic imports in a single "export executor" file (e.g., `doorScheduleExcelExport.ts`) rather than spreading them across files. This keeps the server-exclusion risk contained and auditable.

**Constraint 3: `transpilePackages: ['jszip']` in `next.config.ts`.**

`jszip` requires transpilation. Any new file that statically imports `jszip` will be transpiled correctly. No action needed for splits — do not add static `import jszip` to any new file; use the existing dynamic `import('jszip')` pattern.

**Constraint 4: Turbopack (`next dev --turbopack`) and production webpack both resolve `@/*` alias.**

Both bundlers read `tsconfig.json` paths. The `@/*` → `./*` alias works identically in both. No split-specific configuration is needed.

**Constraint 5: No RSC (React Server Component) usage in target files.**

All five target files and their downstream consumers are client-side. None use `async` component patterns, `fetch()` at the component level, or server actions. This means: no RSC boundary concerns, no `'use server'` considerations, no `async/await` component warnings.

---

## ESLint (Not Configured — Deliberate Action for Refactor)

**Current state:** No project-level ESLint config exists. `next lint` would use Next.js's built-in ESLint config (`eslint-config-next`) but there is no `.eslintrc*` or `eslint.config.*` file.

**Recommendation for this refactor:** Do NOT add ESLint import rules during the modularization sprint. Adding `eslint-plugin-import` or `@typescript-eslint/consistent-type-imports` mid-refactor introduces a second source of failures that would block the executor. These belong in a separate code-quality phase.

**After the refactor is complete**, the following rules are worth adding:
```json
{
  "@typescript-eslint/consistent-type-imports": "error",
  "import/no-cycle": "error"
}
```

---

## Verification Workflow (Per Split)

This is the concrete procedure the executor agent runs for each file split:

```
1. BEFORE SPLIT — Capture baseline
   npx tsc --noEmit 2>&1 | grep "TS2305\|TS2307\|TS2306" > .planning/tsc-baseline.txt

2. CREATE new split files
   - Put types in *Types.ts files
   - Put pure functions/constants in utility files (no 'use client')
   - Put hooks/event logic in *Hook.tsx files (with 'use client')
   - Keep original file as re-export facade OR update consumers directly

3. VERIFY imports compile
   npx tsc --noEmit 2>&1 | grep "TS2305\|TS2307\|TS2306" > .planning/tsc-after.txt
   # Diff: new errors = broken imports introduced by the split
   
4. VERIFY no new errors in specific consumers
   npx tsc --noEmit 2>&1 | grep "<TargetFileName>"

5. RUN the dev server (smoke test)
   npm run dev
   # Navigate to the affected report page and confirm no runtime errors

6. OPTIONAL — Dead import sweep (manual grep)
   grep -rn "from.*DoorScheduleConfig\|from.*HardwareSetConfig" --include="*.ts" --include="*.tsx" .
   # Confirms all consumers still resolve
```

---

## Summary Recommendations

| Decision | Rationale |
|----------|-----------|
| Use `tsc --noEmit` as the primary verification tool | Already configured, catches all import errors, no new dependencies |
| Do NOT install `dependency-cruiser` or `ts-prune` | Overkill for a 5-file refactor; `tsc` covers the risk |
| Do NOT create `hooks/index.ts` or `services/index.ts` barrel files | Risks client/server boundary confusion with Turbopack |
| DO create component-local `index.ts` inside each split subdirectory | Acceptable when all exports share a boundary |
| Extract `DoorScheduleExportConfig` and `HardwareSetExportConfig` types FIRST | 4 services depend on them; type extraction eliminates the component→service import inversion |
| Use `@/` alias in all new split files | Eliminates relative-path fragility when files move between directory levels |
| Use `import type { }` for pure type imports in new files | Required by `isolatedModules: true` for correctness; future-proofs strict mode re-enable |
| Delete `exportDoorScheduleToPDF` (lines 711-902 of excelExportService.ts) during that file's split | Confirmed dead code per PROJECT.md; eliminates ~190 lines from the split scope |
| Keep dynamic `import('jspdf')` / `import('xlsx-js-style')` patterns — do not convert to static | `serverExternalPackages` rule makes static imports of these risky in any file that could execute server-side |
