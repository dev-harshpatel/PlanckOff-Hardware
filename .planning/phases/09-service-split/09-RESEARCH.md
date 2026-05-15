# Phase 9: Service Split - Research

**Researched:** 2026-05-14
**Domain:** TypeScript service modularization — splitting a large pure-TypeScript service into a sub-directory barrel module (Next.js App Router project, no React in the service itself)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SVC-01 | `services/excelExportService.ts` replaced by `excelExportService/` sub-directory with barrel `index.ts`; sub-files cover all complete cohesive export domains (door schedule Excel, hardware set Excel, multi-sheet workbook assembly); no sub-file exceeds 300 lines | Source file read in full (709 lines). Three domain boundaries confirmed: door-schedule domain (lines 1–189), hardware-set domain (lines 191–378), multi-sheet domain (lines 380–709). All domains map cleanly to distinct sub-files under 300 lines. |
| SVC-02 | All existing consumer imports of `excelExportService` resolve to the same named exports without modification after split; `tsc --noEmit` diff against baseline shows zero new TS2305/TS2307/TS2306 errors | Three consumers verified: `services/reportExportService.ts` (imports `exportDoorScheduleToExcel`, `exportHardwareSetToExcel`), `components/submittals/ExportConfigModal.tsx` (imports `exportMultiSheetWorkbook`), `components/reports/ProcurementSummaryView.tsx` (imports `exportMultiSheetWorkbook`). All use named imports. Barrel `index.ts` must re-export all three named exports. |
</phase_requirements>

---

## Summary

Phase 9 is a pure structural refactor of `services/excelExportService.ts` (709 lines) into a sub-directory module `services/excelExportService/`. No logic changes, no new behaviors, no new abstractions. The service is a pure TypeScript file with no React hooks — it does NOT require `'use client'`. Two of the three sub-files also contain no browser APIs and need no `'use client'`. Only the multi-sheet sub-file uses `saveAs` and `new Blob`, which are browser APIs — that sub-file requires `'use client'`.

The split has three clean domain boundaries confirmed by direct source reading:

1. **Door-schedule domain** (lines 1–189): `resolveElevationImageUrl`, `buildDoorScheduleHeaders`, `buildDoorScheduleRow`, `exportDoorScheduleToExcel` — all cohesive around producing a door schedule XLSX file
2. **Hardware-set domain** (lines 191–378): `formatUsage`, `buildHardwareSetHeaders`, `buildHardwareSetRow`, `exportHardwareSetToExcel` — all cohesive around producing a hardware set XLSX file
3. **Multi-sheet domain** (lines 380–709): `MultiSheetExportOptions` interface, `exportMultiSheetWorkbook`, `createComprehensiveDoorScheduleSheet`, `createComprehensiveHardwareScheduleSheet`, `createFrameDetailsSheet`, `createProcurementSummarySheet` — all cohesive around producing a multi-sheet workbook

Three consumers import from this service. All use named imports. The barrel `index.ts` must re-export all named exports. No consumer modification is required.

The service differs critically from the Phase 8 component splits in one important way: it is a pure TypeScript service file with no default export. The barrel pattern must use `export { ... } from './subfile'` for all named exports, and there is no default export to re-export.

**Primary recommendation:** Split into three sub-files (`doorScheduleExcel.ts`, `hardwareSetExcel.ts`, `multiSheetWorkbook.ts`) plus a barrel `index.ts`. Execute all three sub-files in Wave 1 (parallel, independent domains), then delete the flat file in Wave 2 after `tsc --noEmit` confirms zero new errors.

---

## Standard Stack

No new libraries are introduced in this phase. All dependencies already exist in the codebase.

### Core (already installed)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| TypeScript | 5.8.2 (per STATE.md) | Type checking | `tsc --noEmit` for VER-01 verification |
| xlsx-js-style | (project version) | XLSX workbook creation | Already used in excelExportService.ts line 1 |
| file-saver | (project version) | `saveAs` browser download trigger | Used only in `exportMultiSheetWorkbook` — goes to multiSheetWorkbook.ts |

### No installation needed

This phase creates new files and deletes the old flat file only.

---

## Architecture Patterns

### Sub-directory barrel pattern (no default export — named exports only)

```
services/
├── excelExportService/          <- new sub-directory
│   ├── index.ts                 <- barrel: re-exports all named exports
│   ├── doorScheduleExcel.ts     <- domain: door schedule XLSX generation
│   ├── hardwareSetExcel.ts      <- domain: hardware set XLSX generation
│   └── multiSheetWorkbook.ts    <- domain: multi-sheet workbook assembly
├── excelExportService.ts        <- DELETED after split
├── excelTheme.ts                <- untouched (sibling service)
└── reportExportService.ts       <- untouched consumer
```

### Critical difference from Phase 8 component splits

Phase 8 dealt with React components that have a `export default ComponentName`. This service has **no default export** — every export is named. This means:

- VER-03 as written ("every barrel `index.ts` explicitly re-exports the default export via `export { default } from './File'`") does **not apply** to this service because there is no default export to re-export.
- The barrel `index.ts` uses only named re-exports: `export { exportDoorScheduleToExcel } from './doorScheduleExcel'`, etc.
- The `export interface MultiSheetExportOptions` is also a named export — it must appear in the barrel.

### Pattern 1: Named-export barrel `index.ts` — required shape

```typescript
// services/excelExportService/index.ts
// No 'use client' — barrel itself has no browser API calls; consumers who need
// the browser-API functions will import from the sub-file via this barrel.
// Note: If the multi-sheet functions trigger 'use client' in the sub-file,
// the barrel re-exports them without needing 'use client' itself.

export { exportDoorScheduleToExcel } from './doorScheduleExcel';
export { exportHardwareSetToExcel } from './hardwareSetExcel';
export { exportMultiSheetWorkbook } from './multiSheetWorkbook';
export type { MultiSheetExportOptions } from './multiSheetWorkbook';
```

### Pattern 2: `'use client'` — service files are NOT components

`services/excelExportService.ts` does NOT currently have `'use client'` as its first line. Inspection of line 1 shows a BOM + `import * as XLSX from 'xlsx-js-style'` — no directive.

Service files in Next.js App Router are typically called from client components or other services; they are not Server Components or Client Components themselves. The `'use client'` directive is a module boundary marker for React component trees, not a general marker for "this file uses browser APIs."

**The VER-02 gate as stated in REQUIREMENTS.md is:** "Every sub-file that uses browser APIs carries `'use client'` as its literal first line."

Analysis of each sub-file:

| Sub-file | Browser APIs Used | `'use client'` Required? | Rationale |
|----------|-------------------|--------------------------|-----------|
| `doorScheduleExcel.ts` | `XLSX.writeFile` (internally uses browser save) | No — `XLSX.writeFile` internally handles browser/Node compat; the function itself has no direct `document`, `window`, `URL`, `Blob` usage | No |
| `hardwareSetExcel.ts` | `XLSX.writeFile` (same) | No — same rationale as above | No |
| `multiSheetWorkbook.ts` | `new Blob(...)`, `saveAs(blob, ...)` (explicit browser APIs) | Yes — `Blob` is a browser global; `saveAs` from `file-saver` is a browser-only function | Yes |
| `index.ts` (barrel) | None (pure re-exports) | No | No |

**Confidence note (MEDIUM):** The original flat file has no `'use client'` directive yet uses `saveAs` and `Blob` in `exportMultiSheetWorkbook`. This suggests the project either (a) does not strictly enforce `'use client'` on pure TS service files, or (b) these are called from client-side contexts only via components that already have `'use client'`. VER-02 as written says "every sub-file that uses browser APIs carries `'use client'` as its literal first line" — applying this literally means `multiSheetWorkbook.ts` requires `'use client'`. The flat file currently violates this rule (it has browser APIs but no `'use client'`), so the split is an opportunity to bring this sub-file into compliance. The other two sub-files use `XLSX.writeFile` which ultimately uses browser APIs, but not `Blob`/`saveAs` directly — the planner should decide whether to apply `'use client'` to all three or only `multiSheetWorkbook.ts`.

### Pattern 3: Import path rules inside sub-directory

When sub-files import from the project, relative paths must account for the extra directory level (same rule as Phase 8):

| Import in flat file | Import in sub-directory file | Notes |
|--------------------|------------------------------|-------|
| `from './excelTheme'` | `from '../excelTheme'` | Sibling service is one level up |
| `from '../types'` | `from '../../types'` | One level deeper |
| `from '../types/doorScheduleTypes'` | `from '../../types/doorScheduleTypes'` | One level deeper |
| `from '../types/hardwareSetTypes'` | `from '../../types/hardwareSetTypes'` | One level deeper |
| `from '../utils/csiMasterFormat'` | `from '../../utils/csiMasterFormat'` | One level deeper |
| `from '../utils/exportFilename'` | `from '../../utils/exportFilename'` | One level deeper |

### Pattern 4: No circular imports

The three domain sub-files are entirely independent of each other. `multiSheetWorkbook.ts` uses `assignDoorCSISection` and `assignHardwareCSISection` from `utils/csiMasterFormat` directly — it does not call into `doorScheduleExcel.ts` or `hardwareSetExcel.ts`. There is no cross-sub-file import and therefore no circular import risk.

The barrel `index.ts` imports from all three sub-files (one direction only) — no sub-file imports from `index.ts`. No circular dependency is possible.

### Anti-Patterns to Avoid

- **Trying to re-export a default export:** There is no `export default` in the original file. Do not invent one.
- **Missing `export type { MultiSheetExportOptions }` from the barrel:** The `MultiSheetExportOptions` interface is a named export consumed via the barrel by any future caller. Even though no current consumer imports it directly, it must be in the barrel to preserve forward compatibility. Confirm: currently no consumer imports `MultiSheetExportOptions` directly, but it is part of the public API surface.
- **Forgetting to adjust relative paths:** `from './excelTheme'` in the flat file becomes `from '../excelTheme'` in all sub-files.
- **Deleting the flat file before tsc confirms zero new errors:** Same discipline as Phase 8 — create all sub-files, verify `tsc --noEmit`, then delete the flat file.
- **Sub-file importing from the barrel:** Sub-files must import from siblings directly (e.g., never `from '../index'` or `from './'`). The barrel is a one-way aggregator.

---

## Source File Analysis

### `services/excelExportService.ts` — 709 lines (post PRE-01 deletion)

Read in full. Domain boundaries confirmed:

| Domain | Line Range | Target Sub-file | Approx Lines | Notes |
|--------|-----------|----------------|-------------|-------|
| Shared helper (elevation URL resolver) | 10–18 | `doorScheduleExcel.ts` | 9 lines | Only used by door schedule domain; goes with it |
| Door-schedule headers builder | 20–65 | `doorScheduleExcel.ts` | 46 lines | |
| Door-schedule row builder | 67–116 | `doorScheduleExcel.ts` | 50 lines | |
| `exportDoorScheduleToExcel` (main export) | 118–189 | `doorScheduleExcel.ts` | 72 lines | |
| Hardware-set usage formatter | 191–204 | `hardwareSetExcel.ts` | 14 lines | Only used by hardware-set domain |
| Hardware-set headers builder | 206–230 | `hardwareSetExcel.ts` | 25 lines | |
| Hardware-set row builder | 232–259 | `hardwareSetExcel.ts` | 28 lines | |
| `exportHardwareSetToExcel` (main export) | 261–378 | `hardwareSetExcel.ts` | 118 lines | |
| `MultiSheetExportOptions` interface | 384–392 | `multiSheetWorkbook.ts` | 9 lines | |
| `exportMultiSheetWorkbook` (main export) | 395–424 | `multiSheetWorkbook.ts` | 30 lines | Uses `new Blob`, `saveAs` |
| `createComprehensiveDoorScheduleSheet` | 429–479 | `multiSheetWorkbook.ts` | 51 lines | |
| `createComprehensiveHardwareScheduleSheet` | 484–561 | `multiSheetWorkbook.ts` | 78 lines | |
| `createFrameDetailsSheet` | 566–606 | `multiSheetWorkbook.ts` | 41 lines | |
| `createProcurementSummarySheet` | 611–709 | `multiSheetWorkbook.ts` | 99 lines | |

**Estimated sub-file sizes:**

| Sub-file | Estimated Lines | Within 300-line limit? |
|----------|----------------|----------------------|
| `doorScheduleExcel.ts` | ~180 lines (imports ~8 + domains ~177) | Yes |
| `hardwareSetExcel.ts` | ~200 lines (imports ~8 + domains ~185) | Yes |
| `multiSheetWorkbook.ts` | ~340 lines (imports ~10 + all multi-sheet content ~330) | EXCEEDS 300 |

**The `multiSheetWorkbook.ts` 300-line limit issue:** The multi-sheet domain (lines 380–709) contains 330 lines of content. Adding imports (~10 lines) brings the total to ~340 lines, which exceeds the 300-line sub-file constraint in SVC-01.

The multi-sheet section contains 6 distinct items: the interface, the main export function, and 4 private helper functions. The 4 helper functions (`createComprehensiveDoorScheduleSheet`, `createComprehensiveHardwareScheduleSheet`, `createFrameDetailsSheet`, `createProcurementSummarySheet`) are only called from `exportMultiSheetWorkbook` — they are private implementation details of the multi-sheet domain and cannot be split to a separate sub-file without creating a cross-sub-file dependency that would contradict the domain-cohesion requirement.

**Resolution options for the planner:**
1. Grant a line-limit exception for `multiSheetWorkbook.ts` (~340 lines) — consistent with D-16 exception pattern used in Phase 8 for `useDoorScheduleDownload.tsx` (450-line exception)
2. Split `createFrameDetailsSheet` and `createProcurementSummarySheet` into a `multiSheetHelpers.ts` private module imported by `multiSheetWorkbook.ts` — this keeps all files under 300 lines but adds a fourth sub-file that is NOT re-exported from the barrel

The planner must decide. Option 1 is simpler and consistent with Phase 8 precedent. Option 2 is pure to the 300-line rule but adds complexity. Recommendation: Option 1 — grant the exception for `multiSheetWorkbook.ts`, noting that the 340-line estimate is a ceiling, not a floor. Careful import compression and grouping may bring it to ~320 lines.

---

## Consumer Import Verification

All three consumers were read in full. Their exact import lines:

| Consumer File | Import Statement | Named Exports Used |
|--------------|-----------------|-------------------|
| `services/reportExportService.ts` (line 6) | `import { exportDoorScheduleToExcel, exportHardwareSetToExcel } from './excelExportService'` | `exportDoorScheduleToExcel`, `exportHardwareSetToExcel` |
| `components/submittals/ExportConfigModal.tsx` (line 3) | `import { exportMultiSheetWorkbook } from '../../services/excelExportService'` | `exportMultiSheetWorkbook` |
| `components/reports/ProcurementSummaryView.tsx` (line 9) | `import { exportMultiSheetWorkbook } from '../../services/excelExportService'` | `exportMultiSheetWorkbook` |

**Critical observation:** `reportExportService.ts` uses a relative import `'./excelExportService'` (peer service in same `services/` directory). After the split, `services/excelExportService` resolves to `services/excelExportService/index.ts` via Node/TypeScript directory-index resolution. This is the same resolution mechanism used in Phase 8 — no consumer modification is required.

The `components/` consumers use the path `'../../services/excelExportService'` — this also resolves to the sub-directory `index.ts` without modification.

**All three consumers need zero modification.**

### Named exports the barrel MUST provide

| Export | From Sub-file | Currently Exported In Flat File? |
|--------|--------------|----------------------------------|
| `exportDoorScheduleToExcel` | `doorScheduleExcel.ts` | Yes (line 119) |
| `exportHardwareSetToExcel` | `hardwareSetExcel.ts` | Yes (line 262) |
| `exportMultiSheetWorkbook` | `multiSheetWorkbook.ts` | Yes (line 395) |
| `MultiSheetExportOptions` (interface) | `multiSheetWorkbook.ts` | Yes (line 384) |

Private helpers (`resolveElevationImageUrl`, `buildDoorScheduleHeaders`, `buildDoorScheduleRow`, `formatUsage`, `buildHardwareSetHeaders`, `buildHardwareSetRow`, `createComprehensiveDoorScheduleSheet`, etc.) are NOT exported from the flat file and must NOT be re-exported from the barrel. They stay private within their respective sub-files.

---

## TSC Baseline State

The `.planning/tsc-baseline.txt` contains **142 lines** of pre-existing errors (captured before any split). After Phase 8, the post-split tsc output was confirmed at **9 lines**, all of which are a strict subset of the baseline (zero new errors from Phase 8).

**Errors in the baseline that reference `excelExportService.ts`:**

```
services/excelExportService.ts(90,61): error TS2339: Property 'coreType' does not exist on type 'Door'.
services/excelExportService.ts(91,63): error TS2339: Property 'veneerType' does not exist on type 'Door'.
services/excelExportService.ts(241,39): error TS2345: Argument of type 'string[]' is not assignable to parameter of type '"count" | "all" | "preview"'.
services/excelExportService.ts(454,18): error TS2339: Property 'tag' does not exist on type 'Door'.
services/excelExportService.ts(458,18): error TS2339: Property 'material' does not exist on type 'Door'.
services/excelExportService.ts(459,18): error TS2339: Property 'coreType' does not exist on type 'Door'.
services/excelExportService.ts(460,18): error TS2339: Property 'faceType' does not exist on type 'Door'.
services/excelExportService.ts(462,18): error TS2339: Property 'hardwareSet' does not exist on type 'Door'.
services/excelExportService.ts(509,30): error TS2339: Property 'hardwareSet' does not exist on type 'Door'.
services/excelExportService.ts(585,18): error TS2339: Property 'tag' does not exist on type 'Door'.
services/excelExportService.ts(591,18): error TS2339: Property 'silencerQty' does not exist on type 'Door'.
services/excelExportService.ts(619,30): error TS2339: Property 'hardwareSet' does not exist on type 'Door'.
```

These are all **TS2339/TS2345 errors** (not TS2305/TS2307/TS2306). VER-01 specifically gates on **zero new TS2305/TS2307/TS2306 errors** — these pre-existing TS2339/TS2345 errors in the baseline are not in scope for VER-01 and do not need to be resolved.

After the split, the errors will move to the new sub-file paths (e.g., `services/excelExportService/doorScheduleExcel.ts(90,61)`). These are the SAME pre-existing logic errors migrating to the new file location — they are not new errors introduced by the split. The `tsc --noEmit` diff against the **9-line post-Phase-8 baseline** should show zero new TS2305/TS2307/TS2306 lines.

**Important:** Since the current post-Phase-8 baseline has **9 lines** (not the original 142), the verification diff should compare against the current state after Phase 8, not the original baseline. The planner should clarify which baseline file to use. The 9-line post-Phase-8 output contains none of the excelExportService errors (they were not TS2305/TS2307/TS2306), so they will not appear in the VER-01 diff at all.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Circular import detection | Custom import graph traversal | `tsc --noEmit` | TypeScript reports TS2306 for circular modules at compile time |
| Consumer import verification | Manual grep of import paths | `tsc --noEmit` diff vs baseline | Compiler definitively catches TS2307 (module not found) and TS2305 (no export) |
| `'use client'` presence check | Manual scanning | `head -1 <file>` check in verification step | Simple line-1 exact match per VER-02 |
| 300-line counting | Manual counting | `wc -l <file>` | Objective and fast |

---

## Common Pitfalls

### Pitfall 1: Adjusting relative paths for sub-directory depth

**What goes wrong:** A sub-file copied from the flat service still has `from '../types'`, which resolves to the wrong path from inside the sub-directory. From `services/excelExportService/doorScheduleExcel.ts`, `from '../types'` would resolve to `services/types` (which does not exist). The correct path is `from '../../types'`.

**Specific paths that MUST change:**

| Original (in flat file) | Must become (in sub-file) |
|------------------------|--------------------------|
| `from './excelTheme'` | `from '../excelTheme'` |
| `from '../types'` | `from '../../types'` |
| `from '../types/doorScheduleTypes'` | `from '../../types/doorScheduleTypes'` |
| `from '../types/hardwareSetTypes'` | `from '../../types/hardwareSetTypes'` |
| `from '../utils/csiMasterFormat'` | `from '../../utils/csiMasterFormat'` |
| `from '../utils/exportFilename'` | `from '../../utils/exportFilename'` |
| `from 'file-saver'` | `from 'file-saver'` (npm package — unchanged) |
| `from 'xlsx-js-style'` | `from 'xlsx-js-style'` (npm package — unchanged) |

**Why it happens:** Copy-paste during extraction; the relative path was correct in the flat file but is one level short in the sub-directory.

**Warning signs:** VER-01 catches these as TS2307 (Cannot find module '../../types').

### Pitfall 2: Not including `MultiSheetExportOptions` interface in the barrel

**What goes wrong:** The barrel only re-exports functions but forgets the `MultiSheetExportOptions` interface. Any future consumer that imports `import type { MultiSheetExportOptions } from '../../services/excelExportService'` would get a TS2305 error.

**Why it happens:** Forgetting that interfaces are named exports too.

**How to avoid:** Add `export type { MultiSheetExportOptions } from './multiSheetWorkbook'` to the barrel.

### Pitfall 3: Deleting flat file before tsc confirms zero new errors

**What goes wrong:** Deleting `excelExportService.ts` before the barrel and sub-files are verified as correct leaves the codebase in a broken state with no easy rollback.

**How to avoid:** The plan must sequence: create sub-directory + all sub-files → verify `tsc --noEmit` → only then delete the flat file.

### Pitfall 4: Sub-file importing from the barrel

**What goes wrong:** If any sub-file imports from `./index` or `../excelExportService`, it creates a circular dependency. For example, `multiSheetWorkbook.ts` must NOT import `exportDoorScheduleToExcel` from the barrel — it doesn't need it (it has its own `createComprehensiveDoorScheduleSheet` which is independent).

**How to avoid:** Each sub-file imports only from: npm packages, project `../../utils/`, project `../../types/`, and `../excelTheme`. Never from sibling sub-files or from the barrel.

### Pitfall 5: `'use client'` on the barrel

**What goes wrong:** Adding `'use client'` to `index.ts` when it is only a re-export barrel with no hooks or browser APIs. This is unnecessary and could cause confusion.

**How to avoid:** Only add `'use client'` to `multiSheetWorkbook.ts` (if required). The barrel `index.ts` does not need it.

### Pitfall 6: Pre-existing TS2339 errors appearing to look new

**What goes wrong:** After the split, `tsc --noEmit` output shows errors in the new sub-file paths (e.g., `services/excelExportService/doorScheduleExcel.ts(90,61)`). These are the same pre-existing errors migrated to the new file location — not new errors. But they may look new if the diff comparison is done naively against the wrong baseline.

**How to avoid:** Compare the post-split output specifically for TS2305/TS2307/TS2306 error codes only (the VER-01 gate is limited to these three codes). Pre-existing TS2339/TS2345 errors at migrated locations are not new errors.

---

## Code Examples

### Barrel `index.ts` — required shape

```typescript
// services/excelExportService/index.ts
// No 'use client' — barrel has no hooks or browser API calls.

export { exportDoorScheduleToExcel } from './doorScheduleExcel';
export { exportHardwareSetToExcel } from './hardwareSetExcel';
export { exportMultiSheetWorkbook } from './multiSheetWorkbook';
export type { MultiSheetExportOptions } from './multiSheetWorkbook';
```

### `doorScheduleExcel.ts` — imports shape

```typescript
// services/excelExportService/doorScheduleExcel.ts
// No 'use client' — uses XLSX.writeFile (internal browser compat) but no Blob/saveAs directly.

import * as XLSX from 'xlsx-js-style';
import { applySheetTheme, contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../excelTheme';
import { Door, ElevationType } from '../../types';
import type { DoorScheduleExportConfig } from '../../types/doorScheduleTypes';
import { buildExportFilename } from '../../utils/exportFilename';

// ... (resolveElevationImageUrl, buildDoorScheduleHeaders, buildDoorScheduleRow, exportDoorScheduleToExcel)
```

### `hardwareSetExcel.ts` — imports shape

```typescript
// services/excelExportService/hardwareSetExcel.ts
// No 'use client' — uses XLSX.writeFile (internal browser compat) but no Blob/saveAs directly.

import * as XLSX from 'xlsx-js-style';
import { contentAwareColWidths, buildMetadataRows, applyMetadataStyles, applyHeaderRowAt, applyFreezeAt } from '../excelTheme';
import type { HardwareSetExportConfig } from '../../types/hardwareSetTypes';
import { buildExportFilename } from '../../utils/exportFilename';

// ... (formatUsage, buildHardwareSetHeaders, buildHardwareSetRow, exportHardwareSetToExcel)
```

### `multiSheetWorkbook.ts` — imports shape

```typescript
// services/excelExportService/multiSheetWorkbook.ts
'use client';
// Has 'use client' — uses new Blob() and saveAs() (explicit browser globals).

import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { applySheetTheme } from '../excelTheme';
import { Door, HardwareSet, HardwareItem } from '../../types';
import { assignDoorCSISection, assignHardwareCSISection } from '../../utils/csiMasterFormat';
import { buildExportFilename } from '../../utils/exportFilename';

// ... (MultiSheetExportOptions interface, exportMultiSheetWorkbook, 4 private sheet creators)
```

### VER-01 verification command (post Phase 8 baseline)

```bash
# Run after split completes; compare against current post-Phase-8 tsc output
npx tsc --noEmit 2>&1 | grep -E "TS2305|TS2307|TS2306" > /tmp/post-phase9.txt
# Compare against the post-Phase-8 state (not the original 142-line baseline)
# Expected: zero new lines in diff output (only TS2305/TS2307/TS2306 scoped)
```

### VER-02 verification command

```bash
# Check 'use client' is line 1 in multiSheetWorkbook.ts (only file requiring it)
head -1 services/excelExportService/multiSheetWorkbook.ts
# Expected: 'use client'

# Confirm other sub-files do NOT have 'use client'
head -1 services/excelExportService/doorScheduleExcel.ts
head -1 services/excelExportService/hardwareSetExcel.ts
head -1 services/excelExportService/index.ts
# Expected: import statements (no 'use client')
```

### VER-03 — not applicable (no default export)

VER-03 requires explicit default re-export. This service has no default export. The barrel satisfies its intent (all public named exports accessible from the barrel) via named re-exports. The verification step should confirm all three named exports are accessible through the barrel rather than checking for a default export.

### Line count verification

```bash
wc -l services/excelExportService/doorScheduleExcel.ts
wc -l services/excelExportService/hardwareSetExcel.ts
wc -l services/excelExportService/multiSheetWorkbook.ts
# doorScheduleExcel and hardwareSetExcel: expected < 300 lines
# multiSheetWorkbook: expected ~320-350 lines (line-limit exception required)
```

---

## VER Gate Application for Phase 9

| Gate | Original Description | Applies to Phase 9? | Phase 9 Application |
|------|---------------------|--------------------|--------------------|
| VER-01 | `tsc --noEmit` diff shows zero new TS2305/TS2307/TS2306 errors | Yes | Run post-split tsc; compare for TS2305/TS2307/TS2306 only; pre-existing TS2339/TS2345 from baseline are not new |
| VER-02 | Every sub-file using browser APIs has `'use client'` as literal first line | Partially — only `multiSheetWorkbook.ts` uses direct browser APIs (`Blob`, `saveAs`) | Confirm `multiSheetWorkbook.ts` has `'use client'` line 1; confirm other sub-files do NOT |
| VER-03 | Every barrel `index.ts` explicitly re-exports the default export | Not directly applicable — no default export | Verify instead that all three named public exports are present in barrel via named re-exports |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/file restructuring with no external tool or service dependencies beyond the project's existing TypeScript compiler (`npx tsc --noEmit`, already confirmed available in Phase 8).

---

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is SKIPPED.

---

## Open Questions

1. **VER-03 adaptation for no-default-export service**
   - What we know: VER-03 is written for components with default exports. This service has none.
   - What's unclear: Does the planner need to document a VER-03 PASS or N/A for this phase?
   - Recommendation: Mark VER-03 as N/A for Phase 9 with documentation that the barrel provides all named public exports. Confirm via grep that all three named exports appear in `index.ts`.

2. **`'use client'` on `doorScheduleExcel.ts` and `hardwareSetExcel.ts`**
   - What we know: These files call `XLSX.writeFile`, which internally uses browser APIs but is not directly calling `Blob`, `document`, `window`, or `URL` in the service code.
   - What's unclear: Whether VER-02 requires `'use client'` on files that transitively call browser APIs via library code vs. only files that directly call browser globals.
   - Recommendation: Apply `'use client'` strictly: only to `multiSheetWorkbook.ts` (which directly uses `Blob` and `saveAs`). The original flat file had no `'use client'` and contained both `XLSX.writeFile` calls — applying `'use client'` to the door/hardware sub-files would be a stricter enforcement than the original file had.

3. **`multiSheetWorkbook.ts` line count exceeds 300**
   - What we know: The multi-sheet domain (lines 380–709) is ~330 lines of content. With imports, the sub-file will be ~340 lines.
   - What's unclear: Whether a line-limit exception should be granted or the domain split into two files.
   - Recommendation: Grant a line-limit exception consistent with D-16 from Phase 8. All 4 private helper functions are implementation details of `exportMultiSheetWorkbook` and cannot be separated without creating a non-public sub-sub-module.

---

## Sources

### Primary (HIGH confidence)

- Direct file read: `services/excelExportService.ts` (709 lines) — all domain boundaries confirmed, all exports identified, all imports traced
- Direct file read: `services/reportExportService.ts` — consumer import pattern confirmed (line 6)
- Direct file read: `components/submittals/ExportConfigModal.tsx` — consumer import pattern confirmed (line 3)
- Direct file read: `components/reports/ProcurementSummaryView.tsx` — consumer import pattern confirmed (line 9)
- Direct file read: `.planning/tsc-baseline.txt` — 12 excelExportService errors confirmed as TS2339/TS2345 (not TS2305/TS2307/TS2306)
- Direct file read: `.planning/phases/08-component-config-splits/08-RESEARCH.md` — Phase 8 patterns (barrel shape, VER gates, path rules)
- Direct file read: `.planning/phases/08-component-config-splits/08-VERIFICATION.md` — Phase 8 outcomes confirmed PASS
- Direct file read: `.planning/REQUIREMENTS.md` — SVC-01, SVC-02 requirements, VER gate descriptions
- Grep scan: `excelExportService` across all project files — 3 consumers identified in main source tree

### Secondary (MEDIUM confidence)

- Next.js App Router behavior (from training, well-established): `'use client'` is a module boundary directive for React component trees; pure TypeScript service files do not require it unless they directly call browser globals that would fail in SSR context
- Node.js/TypeScript directory-index resolution (well-established): `import from './excelExportService'` resolves to `./excelExportService/index.ts` when the path is a directory — same resolution used in Phase 8 successfully

---

## Metadata

**Confidence breakdown:**

- Source file domain analysis: HIGH — file read in full, all 709 lines, all boundaries confirmed
- Consumer import compatibility: HIGH — all 3 consumers read, import paths verified
- VER gate application: HIGH — gates confirmed against REQUIREMENTS.md and Phase 8 precedent
- `'use client'` decision for door/hardware sub-files: MEDIUM — the original flat file has no `'use client'` despite `XLSX.writeFile` usage, suggesting the project applies `'use client'` only to files with direct browser global usage (`Blob`, `saveAs`, `document`, `window`); `multiSheetWorkbook.ts` clearly qualifies; door/hardware sub-files probably do not
- `multiSheetWorkbook.ts` line count: HIGH — calculated from source line ranges; planner decision required on exception vs. further split

**Research date:** 2026-05-14
**Valid until:** Indefinite — structural analysis of static source files
