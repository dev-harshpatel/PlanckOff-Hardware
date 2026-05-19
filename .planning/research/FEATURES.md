# Feature Landscape: v2.0 File Modularization

**Domain:** Structural refactor — decomposing large React components, custom hooks, and TypeScript service files
**Researched:** 2026-05-13
**Constraint:** Zero behavior change. No new abstractions. All existing imports from outside the split file must remain valid.

---

## What "Features" Means Here

This milestone has no product features — it is a structural refactor. The "features" are **decomposition boundaries**: the lines along which a file is split, the folder structure those splits land in, and the safety checks that guarantee identical behavior post-split.

The three categories below map directly to the five target files.

---

## Table Stakes

Splits that MUST happen to meet the milestone goal. Every file over 750 lines has a clear, non-controversial boundary.

### 1. React Component: Sub-component Extraction by Render Area

**Files:** `DoorScheduleConfig.tsx` (915 ln), `HardwareSetConfig.tsx` (780 ln)

Both files follow the same layout pattern: a left config sidebar + a right preview panel. Each also contains inline sub-components defined before the main component. These are safe, mechanical extractions.

**DoorScheduleConfig.tsx — concrete boundaries:**

| Segment | Lines (approx) | Natural file name |
|---------|---------------|-------------------|
| `ColumnAccordion` sub-component | 63–132 | `ColumnAccordion.tsx` |
| `GroupedTable` sub-component | 135–267 | `GroupedTable.tsx` |
| Main component: door filter logic + `includedDoors` memo | 271–288 | stays in `DoorScheduleConfig.tsx` |
| Main component: column state + handlers | 291–346 | stays in `DoorScheduleConfig.tsx` |
| Main component: `handleDownload` (Excel branch) | 348–549 | `useDoorScheduleExcelDownload.ts` (hook) |
| Main component: `handleDownload` (PDF branch) | 551–728 | `useDoorSchedulePdfDownload.ts` (hook) |
| Main component: JSX left sidebar | 737–888 | could stay or become `DoorScheduleSidebar.tsx` |
| Main component: JSX right preview panel | 890–1004 | could stay or become `DoorSchedulePreview.tsx` |

The Excel download (lines 374–549) is 176 lines of pure async logic with no JSX; it accesses local state via closure. Extracting it into a custom hook (`useDoorScheduleExcelDownload`) is the canonical pattern for async event handlers in React — the hook receives the state values it needs as parameters and returns the handler function.

The PDF download (lines 551–724) is similarly pure imperative logic. Same treatment.

**HardwareSetConfig.tsx — concrete boundaries:**

| Segment | Lines (approx) | Natural file name |
|---------|---------------|-------------------|
| Exported types (`HardwareSetExportConfig`) | 14–20 | `hardwareSetTypes.ts` (already a pattern in `doorScheduleTypes.ts`) |
| Local types + static config constants | 22–82 | `hardwareSetTypes.ts` or `hardwareSetConfig.ts` |
| Pure helper functions (5 functions, lines 84–274) | 84–274 | `hardwareSetHelpers.ts` |
| `HardwareGroupTable` sub-component | 278–401 | `HardwareGroupTable.tsx` |
| Main component: `usageStats` memo + `groups` derived | 425–455 | stays or `useHardwareGroups.ts` |
| Main component: `handleDownload` (xlsx + pdf) | 489–594 | `useHardwareSetDownload.ts` |
| Main component: JSX sidebar + preview | 598–780 | stays in `HardwareSetConfig.tsx` |

**Complexity:** LOW. These are straight cuts along comment-delimited sections that already exist in the files (the `// ─── Sub-components ───` and `// ─── Pure helpers ───` dividers are already there).

### 2. React Component: `PricingReportConfig.tsx` — Already Mostly Split

**File:** `PricingReportConfig.tsx` (745 ln)

Unlike the other two config components, `PricingReportConfig` already delegates heavily to custom hooks (`usePricingFilters`, `usePricingProposal`, `usePricingExport`) and sub-components (`PricingHierarchyView`, `PricingTableRows`, `PricingDetailModal`). The 745 lines are mostly JSX for four tabs (Door, Frame, Hardware, Proposal) with inline table markup.

**Boundaries:**

| Segment | Lines (approx) | Natural file name |
|---------|---------------|-------------------|
| Export dialog state + handler | 37–42, 204–208 | `useExportDialog.ts` (tiny hook) or stays in component |
| Proposal tab JSX (doors/frames/hardware/expenses/tax/remarks tables) | 356–709 | `ProposalTab.tsx` |
| Door/Frame/Hardware pricing tab table JSX | 712–745 + table header logic | `PricingTab.tsx` or stays as-is |

The proposal tab (lines 356–709) is 354 lines of pure JSX with no state of its own — it reads from props passed down. Extracting it as `<ProposalTab>` receiving the proposal-related values as props is a clean zero-behavior-change split.

**Complexity:** LOW-MEDIUM. The proposal tab props surface is large (20+ values from `usePricingProposal` + `usePricingFilters`). Must not introduce a new context or change prop shapes.

### 3. Custom Hook: Splitting `useDoorTableState.tsx` by Concern

**File:** `useDoorTableState.tsx` (783 ln)

This hook is a monolith of five distinct concerns bundled together because they share the same state/ref scope.

**Concrete concern boundaries:**

| Concern | Lines (approx) | Extractable to |
|---------|---------------|----------------|
| Exported constants: `ALL_AVAILABLE_COLUMNS`, `DOOR_SECTION_KEYS`, `FRAME_SECTION_KEYS`, `HARDWARE_SECTION_KEYS`, `formatDimension`, types | 11–98 | `doorTableColumns.ts` — pure data, zero React |
| Filter state: `statusFilter`, `doorMaterialFilter`, `frameMaterialFilter`, `searchQuery`, derived `statusCounts`, `uniqueDoorMaterials`, `uniqueFrameMaterials`, `filteredAndSortedDoors`, `handleSort`, `sortConfig` | 124–339 | `useDoorFilters.ts` |
| Column prefs state: `visibleColumns`, `columnOrder`, `customColumns`, localStorage read/write effects, column drag handlers, `orderedColumns`, `allSelectableColumnKeys`, `areAllColumnsSelected`, `toggleColumn`, `toggleAllColumns`, `addCustomColumn`, `removeCustomColumn`, `isColumnCustomizerOpen` | 139–148, 174–238, 539–629 | `useDoorColumnPrefs.ts` |
| Inline cell editing: `editingCell`, `tempValue`, `inputRef`, `startEditing`, `cancelEditing`, `saveEdit`, `handleKeyDown`, `renderCell` | 130–132, 168–172, 442–529, 531–537, 680–775 | `useDoorCellEditor.ts` |
| Row selection: `selectedRows`, `toggleSelectAll`, `toggleRowSelection`, `handleDeleteSelected`, `handleDeleteRow` | 149, 403–426, 427–440 | `useDoorRowSelection.ts` |
| Hardware assignment: `handleAssignHardware`, `handleAssignAll`, `isAssigningBatch`, `validSetNames` | 128, 164–166, 341–378, 370–378 | `useDoorHardwareAssignment.ts` |
| Door CRUD + modal: `editModalDoor`, `savingDoorId`, `handleAddDoor`, `handleDoorSave` | 136–137, 379–401, 631–677 | `useDoorEdit.ts` |
| Table header rendering: `renderHeader`, `SortIcon`, drag-over state `dragOverKey` | 141, 777–821 | `useDoorTableHeader.tsx` (has JSX) |
| Upload error state: `lastErrorTask`, `hasUploadErrors`, `hasRowErrors` | 154–162 | stays in main hook or `useDoorUploadStatus.ts` |
| Filter menu state: `isFilterMenuOpen`, `filterMenuRef`, outside-click effect | 151–152, 240–253 | stays in main hook (2 state vars + 1 effect = not worth splitting) |

**Key dependency constraint:** Every one of these sub-hooks must receive their shared dependencies (e.g., `doors`, `onDoorsUpdate`, `projectId`, `hardwareSets`) as parameters. None of them can reach across hook boundaries. The main `useDoorTableState` becomes an orchestrator that calls each sub-hook and spreads their returns.

**Complexity:** MEDIUM. The concern boundaries are clear but the return surface of the main hook is large (55+ exported values/functions). Splitting into sub-hooks and re-assembling in the orchestrator must preserve the exact same return shape.

### 4. Service File: Splitting `excelExportService.ts` by Domain

**File:** `excelExportService.ts` (794 ln, but lines 711–901 confirmed dead code)

**Dead code finding (confirmed in PROJECT.md):** `exportDoorScheduleToPDF` (lines 711–901) is unused — safe to delete, not split.

**Concrete domain boundaries:**

| Domain | Lines (approx) | Natural file name |
|---------|---------------|-------------------|
| Door schedule helpers + `exportDoorScheduleToExcel` | 10–189 | `services/doorScheduleExcelService.ts` |
| Hardware set helpers + `exportHardwareSetToExcel` + `formatUsage` | 191–378 | `services/hardwareSetExcelService.ts` |
| `MultiSheetExportOptions` + `exportMultiSheetWorkbook` + 4 sheet-builder helpers | 380–708 | `services/multiSheetExcelService.ts` |
| Dead code: `exportDoorScheduleToPDF` | 710–901 | DELETE — do not move |

**Import preservation constraint:** The service is imported in at least two places from outside:
- `components/doorSchedule/DoorScheduleConfig.tsx` imports `DoorScheduleExportConfig` from it (actually from `DoorScheduleConfig.tsx` itself — the type is defined there, not in `excelExportService.ts`)
- Other callers of `exportDoorScheduleToExcel`, `exportHardwareSetToExcel`, `exportMultiSheetWorkbook` must continue to work

After splitting, the original `excelExportService.ts` should become a barrel re-export file:
```typescript
export { exportDoorScheduleToExcel } from './doorScheduleExcelService';
export { exportHardwareSetToExcel }  from './hardwareSetExcelService';
export { exportMultiSheetWorkbook, type MultiSheetExportOptions } from './multiSheetExcelService';
```
This preserves every existing import path without any changes at call sites.

**Complexity:** LOW. The three domains have zero shared state — they only share `excelTheme` imports (already a separate file) and utility imports. Each helper function is already private to its domain.

---

## Differentiators

Patterns that are safe, proven, and result in meaningfully better code structure.

### Download Logic as Custom Hooks

The `handleDownload` functions in `DoorScheduleConfig.tsx` and `HardwareSetConfig.tsx` are each 150-250 lines of async imperative logic with zero JSX. Extracting them as `use*Download` hooks (e.g., `useDoorScheduleExcelDownload`, `useDoorSchedulePdfDownload`) follows the same pattern already used for `usePricingExport` in `PricingReportConfig.tsx`. The hook receives the state values it needs as parameters and returns a single async handler function.

This is the right pattern because:
- The logic is testable in isolation without rendering a component
- The component body becomes readable without scrolling through 200+ lines of OOXML XML-building
- The pattern is already established in this codebase (`usePricingExport`, `useElevationImages`, `useDoorAggregation`)

### Pure Data Files for Column Definitions and Static Config

`useDoorTableState.tsx` contains `ALL_AVAILABLE_COLUMNS` (44 lines), `DOOR_SECTION_KEYS`, `FRAME_SECTION_KEYS`, `HARDWARE_SECTION_KEYS`, and `formatDimension`. These are pure data/utility with no React dependencies. Extracting them to `doorTableColumns.ts` (a `.ts` not `.tsx` file) makes the data importable by services and tests without pulling in React hooks.

`HardwareSetConfig.tsx` contains `REQUIRED_COLUMN_DEFS`, `GROUPING_OPTIONS`, `USAGE_OPTIONS` (static arrays) and five pure helper functions. Same treatment: move to `hardwareSetHelpers.ts`.

This pattern is already used in this codebase: `doorScheduleTypes.ts` holds types shared between `DoorScheduleConfig.tsx` and downstream services.

### Barrel Re-export for Split Services

When `excelExportService.ts` is split, keeping the original filename as a barrel re-export is strictly better than updating all call sites. This is the zero-import-change guarantee. The pattern is: split the implementation, leave the old filename as `export { ... } from './newFile'` forwarding declarations.

---

## Anti-Features

Patterns to explicitly avoid. These would violate the zero-behavior-change constraint or introduce scope creep.

### Context Instead of Props for Sub-components

`GroupedTable` (in `DoorScheduleConfig.tsx`) and `HardwareGroupTable` (in `HardwareSetConfig.tsx`) currently receive props directly. Do NOT introduce React Context to pass `selectedColumns`, `format`, or `usageDisplay` down to these components. Prop drilling is fine here — both components are one level deep from the parent and the prop list is explicit. Context would introduce a new abstraction, change component identity, and require context provider wrapping in the parent's JSX.

### Merging Concerns When Extracting Hook Slices

When `useDoorTableState` is split, do NOT merge logically separate concerns into one sub-hook just because they share a state variable. For example, `editingCell` drives both `renderCell` (the cell display logic) and `saveEdit` (the commit logic). Both belong in `useDoorCellEditor` — but do not merge `useDoorCellEditor` with `useDoorFilters` just because both access `doors`. Keep concerns separate; the orchestrator hook handles composition.

### New Types or Interfaces During the Split

Do not add new TypeScript types, interfaces, or type aliases as part of these splits. The only types to add are `import type` re-exports if an existing type needs to be visible from a new location. Adding new types means the split is not purely structural.

### Moving the Dead Code Instead of Deleting It

`exportDoorScheduleToPDF` in `excelExportService.ts` (lines 711–901) is confirmed dead code (PROJECT.md "Active" items list). Do not move it to a new file "just in case." Delete it. Moving dead code gives it false legitimacy and it will never be cleaned up later.

### Splitting PricingReportConfig Below Sub-component Granularity

`PricingReportConfig.tsx` has individual inline tables for doors, frames, hardware, and the proposal tab. Do NOT split each of the three pricing tables (door table, frame table, hardware table) into separate files — they are each 30-50 lines and share the same `activeTab`, `filters`, and `prices` state. The correct granularity is the proposal tab (354 lines of JSX that is already semantically distinct) as a single `<ProposalTab>` component. Below that, no splitting is warranted.

### Re-structuring Folder Hierarchy

Do not move files to new folders as part of this milestone. All new files land in the same directory as the file being split. For example, `ColumnAccordion.tsx` goes in `components/doorSchedule/` (not in a new `components/doorSchedule/subcomponents/` subfolder). Adding directory layers changes import paths for files that may already import from the directory.

---

## Feature Dependencies (Split Ordering)

Some splits create dependency ordering requirements:

```
doorTableColumns.ts (pure data)
  → must exist BEFORE useDoorFilters.ts, useDoorColumnPrefs.ts, etc.
  → because sub-hooks import from it

hardwareSetHelpers.ts (pure functions)
  → must exist BEFORE HardwareGroupTable.tsx
  → because HardwareGroupTable calls getItemValue, getUsageCellValue, formatDoorTags

excelExportService.ts barrel re-export
  → must be the LAST step of the excelExportService split
  → after doorScheduleExcelService.ts and hardwareSetExcelService.ts are written
  → so the barrel has valid targets to re-export from
```

All other splits are independent.

---

## MVP Recommendation

For the phase plan, recommend this ordering:

1. **Delete dead code first** (`exportDoorScheduleToPDF` in `excelExportService.ts`) — reduces target size before splitting, removes confusion about what to move
2. **Pure data/helper extractions** (`doorTableColumns.ts`, `hardwareSetHelpers.ts`) — zero risk, no React, no imports to wire
3. **Sub-component extractions** (`ColumnAccordion.tsx`, `GroupedTable.tsx`, `HardwareGroupTable.tsx`) — already delimited by comment banners in the source
4. **Download logic → custom hooks** (`useDoorScheduleExcelDownload.ts`, `useDoorSchedulePdfDownload.ts`, `useHardwareSetDownload.ts`) — largest line reduction, clear closure-to-parameter conversion pattern
5. **`useDoorTableState` sub-hook split** — most complex due to large return surface; do last so other patterns are established
6. **`excelExportService.ts` domain split + barrel re-export** — straightforward after dead code is removed
7. **`PricingReportConfig.tsx` ProposalTab extraction** — optional if other splits already bring all files under 750 lines

Defer: Any `PricingReportConfig.tsx` split beyond the ProposalTab extraction. The file is already well-structured with hooks doing the heavy lifting.

---

## Decision: What Stays Co-located vs. What Gets Its Own File

| Rule | Rationale |
|------|-----------|
| Sub-component with own local `useState` → own file | `ColumnAccordion` has `const [open, setOpen] = useState(false)` — it has independent state lifecycle |
| Sub-component with zero state, pure display → own file only if it exceeds ~80 lines | `GroupedTable` (133 lines) warrants extraction; a 15-line skeleton does not |
| Async handler with no JSX and >100 lines → custom hook | Follows existing `usePricingExport` pattern in this codebase |
| Pure helper functions used only by one component → same folder as that component, not in `utils/` | Keeps coupling explicit; moving to `utils/` implies broader reuse that doesn't exist yet |
| Static constant arrays (column defs, option lists) → separate `.ts` file when shared or >30 lines | `ALL_AVAILABLE_COLUMNS` at 44 entries qualifies; a 3-entry `TABS` array in `PricingReportConfig` does not |
| Types exported from a component file → stay there unless imported by >1 other file | `DoorScheduleExportConfig` is already exported from `DoorScheduleConfig.tsx` and imported by `excelExportService.ts` — do not move it, that changes the import path at the call site |

---

## Sources

- Direct code inspection of all five target files (2026-05-13)
- `F:\PlanckOff-Hardware\.planning\PROJECT.md` — dead code confirmation, tech stack
- Existing codebase patterns: `usePricingExport.ts`, `doorScheduleTypes.ts`, `excelTheme.ts` as prior art for the split patterns recommended here
- Confidence: HIGH — all findings are based on direct code reading, not inferred from general patterns
