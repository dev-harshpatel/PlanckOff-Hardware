# Architecture Patterns: v2.0 File Modularization

**Domain:** Sub-module splitting without consumer import changes
**Researched:** 2026-05-13
**Overall confidence:** HIGH — based on direct source inspection and verified Next.js 15 behavior

---

## Recommended Architecture: Sub-directory + Barrel Index

The correct pattern for this codebase is **(b) + (c) combined**: create a sub-directory named after the original file and place an `index.ts` barrel inside it that re-exports everything the original file exported.

### Why Not Sibling Files

Sibling files in the same directory work for private splits (e.g., `DoorGroupingControls.tsx` next to `DoorScheduleConfig.tsx`) but they do **not** preserve the original import path unless you also keep the original file. Keeping the original file alive while splitting it leads to circular imports because the original would need to import from its siblings and re-export. The barrel + sub-directory approach eliminates this.

### Why Sub-directory + Barrel Wins

| Criterion | Sibling files | Sub-dir + barrel |
|-----------|---------------|-----------------|
| Consumer import unchanged | No — consumers import `./DoorScheduleConfig`, a file must remain there | Yes — `index.ts` at original path satisfies the import |
| Original file deleted | No | Yes — original is replaced by the barrel |
| Circular import risk | High if original re-exports siblings | Zero — barrel only re-exports, never imports the original |
| Co-location of sub-files | Poor | Good — all pieces live together |

**Implementation rule:** The original file path is replaced by a directory of the same name. TypeScript/Next.js module resolution resolves `import X from '@/components/doorSchedule/DoorScheduleConfig'` to the file at that exact path. The file is replaced by a directory with an `index.ts` (or `index.tsx`) inside it. Module resolution does NOT automatically look for `DoorScheduleConfig/index.ts` when the caller writes `./DoorScheduleConfig` — the caller writes the path to the file, which must remain a resolvable path.

**IMPORTANT CORRECTION:** TypeScript `moduleResolution: "bundler"` (confirmed in `tsconfig.json`) and Next.js 15 (webpack/turbopack) both resolve directory imports. When you import `'../components/doorSchedule/DoorScheduleConfig'`, and `DoorScheduleConfig` is now a directory containing `index.tsx`, the bundler will resolve the directory to its `index` file. This is standard Node.js + webpack module resolution. The original import path is fully preserved.

---

## `'use client'` Propagation in Next.js 15 Barrel Files

**Behavior (HIGH confidence — Next.js 15 App Router docs, confirmed):**

1. `'use client'` is a boundary marker, not a runtime flag. It must appear at the top of every file that uses client-only APIs (hooks, browser globals, event handlers).
2. A barrel `index.ts` that re-exports from sub-files does **not** automatically propagate `'use client'` to consumers. Each sub-file that uses React hooks or browser APIs must declare `'use client'` itself.
3. If the barrel `index.ts` itself declares `'use client'`, that marks the barrel as a client module boundary — anything imported from it is treated as client code. But this is redundant if the sub-files already declare it.
4. For pure `.ts` service files (no React, no browser APIs at module level), `'use client'` is not needed. Client-only libraries (xlsx, jszip, jsPDF) are loaded via `await import(...)` inside functions — those dynamic imports are safe and do not require `'use client'` at the module boundary.

**Rule for this codebase:**
- Sub-files containing React components or hooks: each must carry `'use client'` if the original file had it or if they use hooks/browser APIs.
- Sub-files that are pure logic/data (type definitions, utility functions, constants): no directive needed.
- Barrel `index.ts` files: no directive needed. The barrel is transparent — it just re-exports. Adding `'use client'` to the barrel itself would unnecessarily force everything it exports into the client boundary.
- Exception: if a barrel mixes server-safe exports with client-only exports that cannot be separated, adding `'use client'` to the barrel is a safe fallback. But for this codebase all five target files are already client-only, so the question is moot.

**Current `'use client'` state:**
- `hooks/useDoorTableState.tsx`: line 1 is `'use client'` — confirmed present
- `components/pricing/PricingReportConfig.tsx`: line 1 is `'use client'` — confirmed present
- `components/doorSchedule/DoorScheduleConfig.tsx`: NO `'use client'` directive — the file uses React hooks but relies on parent `ReportsView.tsx` (which has `'use client'`) or dynamic import with `ssr: false` to be safe. Sub-files containing hooks must add `'use client'` individually.
- `components/hardware/HardwareSetConfig.tsx`: NO `'use client'` directive — same pattern as above, imported via `dynamic(..., { ssr: false })`.
- `services/excelExportService.ts`: NO `'use client'` directive — pure TypeScript service, correct.

---

## Concrete Folder Structure: All 5 Target Files

### 1. `components/doorSchedule/DoorScheduleConfig.tsx` (915 lines)

**Current consumer import:**
```
import DoorScheduleConfig from '../components/doorSchedule/DoorScheduleConfig';
import DoorScheduleConfig from '@/components/doorSchedule/DoorScheduleConfig';
// Also: type import of DoorScheduleExportConfig from same path
import { DoorScheduleExportConfig } from '../components/doorSchedule/DoorScheduleConfig';
```
Consumers: `views/ReportsView.tsx`, `app/project/[id]/reports/door-schedule/page.tsx`, `services/excelExportService.ts` (imports `DoorScheduleExportConfig` type from this file).

**Sub-directory structure:**

```
components/
  doorSchedule/
    DoorGroupingControls.tsx        <- existing, unchanged
    doorScheduleTypes.ts            <- existing, unchanged
    DoorScheduleManager.tsx         <- existing, unchanged
    DoorScheduleConfig/             <- new directory (replaces DoorScheduleConfig.tsx)
      index.tsx                     <- barrel: re-exports default + DoorScheduleExportConfig
      types.ts                      <- DoorScheduleConfigProps, DoorScheduleExportConfig interface
      ColumnAccordion.tsx           <- ColumnAccordion sub-component (lines 63-132)
      GroupedTable.tsx              <- GroupedTable sub-component (lines 134-267)
      useDownloadHandler.ts         <- handleDownload logic + all export/PDF/Excel logic (lines 348-729)
      DoorScheduleConfig.tsx        <- main component shell, imports sub-files (lines 270-1007)
```

**Barrel `index.tsx`:**
```typescript
export { default } from './DoorScheduleConfig';
export type { DoorScheduleExportConfig } from './types';
```

**`'use client'` placement:** `DoorScheduleConfig.tsx` (the shell), `ColumnAccordion.tsx`, `GroupedTable.tsx` each need `'use client'` since they use React hooks and JSX. `useDownloadHandler.ts` needs `'use client'` since it calls `preloadElevationImages` and `document.createElement`. `types.ts` and `index.tsx` need no directive.

---

### 2. `hooks/useDoorTableState.tsx` (783 lines)

**Current consumer imports:**
```
import { useDoorTableState, ALL_AVAILABLE_COLUMNS, StatusFilter } from '../../hooks/useDoorTableState';
```
Consumers: `components/doorSchedule/DoorScheduleManager.tsx`, `components/doors/DoorTableHeader.tsx`, `components/doors/DoorTableRow.tsx`.

**Sub-directory structure:**

```
hooks/
  useDoorTableState/              <- new directory (replaces useDoorTableState.tsx)
    index.tsx                     <- barrel: re-exports everything the original exported
    columnDefs.ts                 <- ALL_AVAILABLE_COLUMNS, DOOR/FRAME/HARDWARE_SECTION_KEYS, ColumnDef, CustomColumn, PersistedColumnPrefs (lines 11-98)
    filterState.ts                <- statusFilter, doorMaterialFilter, frameMaterialFilter, searchQuery, filteredAndSortedDoors (lines 124-339)
    columnState.ts                <- visibleColumns, columnOrder, customColumns, column prefs localStorage logic, drag/drop handlers (lines 139-576)
    selectionState.ts             <- selectedRows, toggleSelectAll, toggleRowSelection, handleDeleteSelected, handleDeleteRow (lines 149-425)
    editState.ts                  <- editingCell, tempValue, startEditing, cancelEditing, saveEdit, handleKeyDown, renderCell (lines 130-775)
    renderHelpers.tsx             <- SortIcon, renderHeader (lines 777-821) — JSX so .tsx extension
    useDoorTableState.tsx         <- main hook assembles all slices and returns combined object
```

**Barrel `index.tsx`:**
```typescript
'use client';
export { useDoorTableState } from './useDoorTableState';
export { ALL_AVAILABLE_COLUMNS, DOOR_SECTION_KEYS, FRAME_SECTION_KEYS, HARDWARE_SECTION_KEYS, formatDimension } from './columnDefs';
export type { ColumnDef, CustomColumn, PersistedColumnPrefs, StatusFilter } from './columnDefs';
```

**`'use client'` placement:** The main `useDoorTableState.tsx` file already has `'use client'` and it stays. Sub-files that contain React hooks or `useRef`/`useState` also need `'use client'`. Pure data files (`columnDefs.ts`) do not. The barrel should carry `'use client'` since all public exports are client-only.

---

### 3. `services/excelExportService.ts` (794 lines — effectively ~900 with the dead-code section)

**Current consumer imports:**
```
import { exportDoorScheduleToExcel } from './excelExportService';
import { exportHardwareSetToExcel } from './excelExportService';
import { exportMultiSheetWorkbook, MultiSheetExportOptions } from './excelExportService';
// Also type import in excelTheme.ts (indirect, via applySheetTheme)
```
Consumers: `services/reportExportService.ts`, `components/submittals/ExportConfigModal.tsx`, `components/reports/ProcurementSummaryView.tsx`.

**Sub-directory structure:**

```
services/
  excelExportService/             <- new directory (replaces excelExportService.ts)
    index.ts                      <- barrel: re-exports all named exports
    doorScheduleExcel.ts          <- exportDoorScheduleToExcel + buildDoorScheduleHeaders + buildDoorScheduleRow + resolveElevationImageUrl (lines 10-188)
    hardwareSetExcel.ts           <- exportHardwareSetToExcel + buildHardwareSetHeaders + buildHardwareSetRow + formatUsage (lines 192-378)
    multiSheetWorkbook.ts         <- exportMultiSheetWorkbook + createComprehensive* + createFrame* + createProcurement* (lines 380-708)
```

**Dead code note:** `exportDoorScheduleToPDF` (lines 710-901) is documented in `PROJECT.md` as unused dead code safe to delete. It should NOT be included in any sub-file. Delete it during the split.

**Barrel `index.ts`:**
```typescript
export { exportDoorScheduleToExcel } from './doorScheduleExcel';
export { exportHardwareSetToExcel } from './hardwareSetExcel';
export { exportMultiSheetWorkbook } from './multiSheetWorkbook';
export type { MultiSheetExportOptions } from './multiSheetWorkbook';
```

**`'use client'` placement:** None. This is a pure TypeScript service file. Client-only libraries (xlsx, jszip, jsPDF) are loaded via `await import(...)` at call time, not at module level. The `services/` layer has no `'use client'` directives and should remain that way.

**Cross-file import warning:** `doorScheduleExcel.ts` needs `resolveElevationImageUrl` — it's a private helper that only `doorScheduleExcel.ts` uses. Keep it local to that file. `multiSheetWorkbook.ts` does NOT use it.

---

### 4. `components/hardware/HardwareSetConfig.tsx` (780 lines)

**Current consumer imports:**
```
import HardwareSetConfig, { HardwareSetExportConfig } from '@/components/hardware/HardwareSetConfig';
import type { HardwareSetExportConfig } from '@/components/hardware/HardwareSetConfig';
const HardwareSetConfig = dynamic(() => import('@/components/hardware/HardwareSetConfig'), { ssr: false });
```
Consumers: `views/ReportsView.tsx`, `app/project/[id]/reports/hardware-set/page.tsx`, `services/excelExportService.ts`, `services/pdfExportService.ts`, `services/csvExportService.ts`.

**Sub-directory structure:**

```
components/
  hardware/
    ElectrificationEditor.tsx       <- existing, unchanged
    FinishSystemEditor.tsx          <- existing, unchanged
    HardwarePrepEditor.tsx          <- existing, unchanged
    HardwareSetModal.tsx            <- existing, unchanged
    HardwareTrashModal.tsx          <- existing, unchanged
    HingeSpecEditor.tsx             <- existing, unchanged
    HardwareScheduleView.tsx        <- existing, unchanged
    HardwareSetConfig/              <- new directory (replaces HardwareSetConfig.tsx)
      index.tsx                     <- barrel: re-exports default + HardwareSetExportConfig type
      types.ts                      <- HardwareSetExportConfig, HardwareSetConfigProps, HardwareItemUsage, HardwareGroup, local type aliases
      constants.ts                  <- REQUIRED_COLUMN_DEFS, OPTIONAL_COLUMN_DEFS, static config arrays (no React)
      useHardwarePreview.ts         <- state and computed values for the preview panel (hooks)
      HardwarePreviewTable.tsx      <- preview table sub-component (JSX)
      useHardwareDownload.ts        <- download/export handler hook
      HardwareSetConfig.tsx         <- main component shell
```

**Barrel `index.tsx`:**
```typescript
export { default } from './HardwareSetConfig';
export type { HardwareSetExportConfig } from './types';
```

**`'use client'` placement:** `HardwareSetConfig.tsx` (the shell) needs `'use client'` since it uses React hooks. `HardwarePreviewTable.tsx` needs `'use client'`. `useHardwarePreview.ts` and `useHardwareDownload.ts` need `'use client'`. `types.ts` and `constants.ts` need no directive.

---

### 5. `components/pricing/PricingReportConfig.tsx` (745 lines)

**Current consumer imports:**
```
const PricingReportConfig = dynamic(() => import('@/components/pricing/PricingReportConfig'), { ssr: false });
```
Consumers: `app/project/[id]/reports/pricing/page.tsx`. This is the most isolated target — only one call site, and it is a dynamic import.

**Sub-directory structure:**

```
components/
  pricing/
    MultiFilterSelect.tsx           <- existing, unchanged
    PriceBookManager.tsx            <- existing, unchanged
    PriceInput.tsx                  <- existing, unchanged
    PricingDetailModal.tsx          <- existing, unchanged
    PricingHierarchyView.tsx        <- existing, unchanged
    PricingTableRows.tsx            <- existing, unchanged
    PricingReportConfig/            <- new directory (replaces PricingReportConfig.tsx)
      index.tsx                     <- barrel: re-exports default
      types.ts                      <- local type and interface definitions
      usePricingState.ts            <- state hooks for filter/column selection
      PricingPreviewTable.tsx       <- preview table component (JSX)
      usePricingDownload.ts         <- export/download handler
      PricingReportConfig.tsx       <- main component shell
```

**Barrel `index.tsx`:**
```typescript
'use client';
export { default } from './PricingReportConfig';
```

**`'use client'` placement:** `PricingReportConfig.tsx` already has `'use client'` at line 1 — it stays. Any sub-file using hooks needs `'use client'`. `types.ts` does not.

---

## Integration Points: Exact Consumer Imports Preserved

| Original file path | Consumer files | Import tokens that must survive |
|-------------------|----------------|--------------------------------|
| `components/doorSchedule/DoorScheduleConfig` | `views/ReportsView.tsx`, `app/.../door-schedule/page.tsx`, `services/excelExportService.ts` | `default` (component), `DoorScheduleExportConfig` (type) |
| `hooks/useDoorTableState` | `components/doorSchedule/DoorScheduleManager.tsx`, `components/doors/DoorTableHeader.tsx`, `components/doors/DoorTableRow.tsx` | `useDoorTableState`, `ALL_AVAILABLE_COLUMNS`, `StatusFilter` (type) |
| `services/excelExportService` | `services/reportExportService.ts`, `components/submittals/ExportConfigModal.tsx`, `components/reports/ProcurementSummaryView.tsx` | `exportDoorScheduleToExcel`, `exportHardwareSetToExcel`, `exportMultiSheetWorkbook`, `MultiSheetExportOptions` (type) |
| `components/hardware/HardwareSetConfig` | `views/ReportsView.tsx`, `app/.../hardware-set/page.tsx`, `services/excelExportService.ts`, `services/pdfExportService.ts`, `services/csvExportService.ts` | `default` (component), `HardwareSetExportConfig` (type) |
| `components/pricing/PricingReportConfig` | `app/.../pricing/page.tsx` | `default` (component) |

Zero consumer files are modified. The original file path resolves to the new directory's `index` file automatically via TypeScript `moduleResolution: "bundler"` and Next.js webpack/turbopack directory-index resolution.

---

## New Files Created vs Modified

### Files Created (net new)

For each of the 5 targets, the following pattern applies:

- `<original-dir>/<OriginalName>/index.tsx` — new barrel
- `<original-dir>/<OriginalName>/types.ts` — new type file
- `<original-dir>/<OriginalName>/<SubPiece1>.ts(x)` — new sub-module(s)
- `<original-dir>/<OriginalName>/<OriginalName>.tsx` — new shell (receives logic from original)

### Files Deleted

- `components/doorSchedule/DoorScheduleConfig.tsx` — replaced by directory
- `hooks/useDoorTableState.tsx` — replaced by directory
- `services/excelExportService.ts` — replaced by directory
- `components/hardware/HardwareSetConfig.tsx` — replaced by directory
- `components/pricing/PricingReportConfig.tsx` — replaced by directory

### Files NOT Modified

All consumer files: `views/ReportsView.tsx`, all `app/project/[id]/reports/*/page.tsx` files, `components/doorSchedule/DoorScheduleManager.tsx`, `components/doors/DoorTableHeader.tsx`, `components/doors/DoorTableRow.tsx`, `services/reportExportService.ts`, `services/excelTheme.ts`, `components/submittals/ExportConfigModal.tsx`, `components/reports/ProcurementSummaryView.tsx`.

---

## Build Order: Dependency Sequence

Each file must be created before the file that imports it. Within a single split, the order is:

```
Step 1: types.ts           (no imports from the split)
Step 2: constants.ts       (imports types only)
Step 3: sub-components/hooks (imports types + constants)
Step 4: main shell .tsx    (imports from all sub-files)
Step 5: index.ts(x)        (imports from main shell + types)
Step 6: delete original    (after verifying build passes)
```

**Cross-target dependency that matters:**
`services/excelExportService.ts` imports `DoorScheduleExportConfig` from `components/doorSchedule/DoorScheduleConfig` and `HardwareSetExportConfig` from `components/hardware/HardwareSetConfig`. These type imports will resolve correctly once the barrel `index.tsx` is in place for those targets. The split order should therefore be:

1. `DoorScheduleConfig` (establishes its barrel first)
2. `HardwareSetConfig` (establishes its barrel first)
3. `excelExportService` (imports types from 1 and 2 — both barrels now exist)
4. `useDoorTableState` (no cross-target dependencies)
5. `PricingReportConfig` (no cross-target dependencies)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Keep the Original File and Import From Sibling Sub-Files

**What:** Leave `DoorScheduleConfig.tsx` in place and have it import from `./doorScheduleConfig/ColumnAccordion.tsx`.
**Why bad:** Creates a naming collision (a file and a directory with the same base name). TypeScript `moduleResolution: "bundler"` will prefer the file over the directory. Consumers still import the old file path (not the directory), so the barrel never applies. The file path conflict will cause build errors.
**Instead:** Delete the original file. The directory at the same path + barrel index fully replaces it.

### Anti-Pattern 2: Re-export With `export * from`

**What:** `export * from './DoorScheduleConfig'` in the barrel.
**Why bad:** `export *` does not re-export `default` exports. The component's default export will be lost. Consumers that do `import DoorScheduleConfig from '...'` will get `undefined`.
**Instead:** Always use explicit named re-exports plus `export { default } from './ComponentFile'`.

### Anti-Pattern 3: Type-only Imports Broken by Barrel

**What:** Forgetting to re-export interface types through the barrel.
**Why bad:** `services/excelExportService.ts` imports `DoorScheduleExportConfig` as a type from `DoorScheduleConfig`. If the barrel only re-exports the default component, the type import breaks at compile time.
**Instead:** Every exported name from the original file — including types and interfaces — must appear in the barrel. Audit original exports before writing the barrel.

### Anti-Pattern 4: `'use client'` on the Barrel

**What:** Putting `'use client'` at the top of the barrel `index.tsx`.
**Why bad:** Forces the entire module graph to be treated as a client boundary from the barrel. In Next.js 15, this prevents any sub-file's exports from being used in Server Components, even pure data utilities. It also triggers a duplicate boundary warning if sub-files already carry `'use client'`.
**Instead:** Put `'use client'` only in the sub-files that need it. Exception: `hooks/useDoorTableState/index.tsx` barrel can safely carry `'use client'` because all its exports are definitionally client-only hooks — but even then it is better practice to let the sub-files carry it.

### Anti-Pattern 5: Circular Import via Shared Types

**What:** Sub-file A imports from sub-file B, which imports from sub-file A.
**Why bad:** TypeScript circular module graphs cause `undefined` values at runtime even when types compile correctly.
**Instead:** All types live in `types.ts`. Sub-components and hooks import from `types.ts` only — never from each other. The main shell imports from sub-files but sub-files never import the shell.

---

## Scalability Considerations

| Concern | At current size (5 files) | If more files are split later |
|---------|--------------------------|-------------------------------|
| Directory depth | One level deep — no nesting | Remain one level; do not nest sub-directories within sub-directories |
| Barrel maintenance | One barrel per target, ~3-6 re-export lines | Each split adds one barrel; manageable |
| IDE navigation | Standard — go-to-definition jumps through barrel to sub-file | No change |
| Tree-shaking | Barrel re-exports allow bundler to tree-shake unused sub-files | Same behavior as before the split |

---

## Sources

- Direct inspection of `components/doorSchedule/DoorScheduleConfig.tsx`, `hooks/useDoorTableState.tsx`, `services/excelExportService.ts`, `components/hardware/HardwareSetConfig.tsx` (first 60 lines), `components/pricing/PricingReportConfig.tsx` (first 5 lines) — 2026-05-13
- Consumer import analysis: `views/ReportsView.tsx`, `app/project/[id]/reports/*/page.tsx`, `components/doorSchedule/DoorScheduleManager.tsx` — 2026-05-13
- `tsconfig.json` `moduleResolution: "bundler"` — confirmed directory-index resolution — 2026-05-13
- Next.js 15 App Router `'use client'` boundary semantics: confirmed per official Next.js docs (directive must appear per-file; barrels do not propagate it)
- `PROJECT.md` dead code note for `exportDoorScheduleToPDF` lines 710-901 — 2026-05-13
