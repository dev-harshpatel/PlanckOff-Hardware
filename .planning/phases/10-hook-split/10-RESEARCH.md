# Phase 10: Hook Split - Research

**Researched:** 2026-05-14
**Domain:** React hook refactor — concern-sliced sub-directory split with orchestrator pattern
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-01 | `hooks/useDoorTableState.tsx` (783 ln) replaced by `useDoorTableState/` sub-directory with barrel `index.tsx` — concern-sliced sub-files each cover a complete domain (column definitions, filter state, column visibility state, row selection state, cell edit state, render helpers); orchestrator hook assembles them | Full line-by-line domain map in Architecture Patterns section |
| HOOK-02 | All 55+ return values of `useDoorTableState` remain in the public interface unchanged — consumer call sites need zero modification | Complete return value inventory in Architecture Patterns section; call site named-export analysis confirms required public API |
| HOOK-03 | `renderCell` and `renderHeader` remain co-located in the orchestrator file (closure constraint — these functions close over hook state and cannot be extracted without behavior change) | Confirmed by analysis: renderCell (lines 680–775) closes over editingCell, tempValue, inputRef, handleKeyDown, saveEdit, onDoorsUpdate, editingCell — all from multiple sub-domains |

</phase_requirements>

---

## Summary

`hooks/useDoorTableState.tsx` is 883 lines (actual count from source read; REQUIREMENTS.md states 783 — the file has grown since the requirement was authored). The file is a single monolithic React hook with no default export; its public API is named exports only. The hook owns six coherent concern domains: (1) column definitions + section-key constants, (2) filter/search/sort state, (3) column visibility + column ordering + custom columns (persisted to localStorage), (4) row selection state + modal state, (5) cell edit state, and (6) door-level action handlers. The `renderCell` and `renderHeader` functions close over state from at least three different concern domains simultaneously and must remain in the orchestrator.

The split pattern established in Phases 8 and 9 applies with one difference: this hook has no default export, so VER-03's "explicit default re-export" rule is not applicable to the barrel (confirmed by Phase 9 precedent: VER-03 was marked N/A for excelExportService for the same reason). Every sub-file that calls React hooks must carry `'use client'` as its literal first line.

**Primary recommendation:** Split into five sub-files (columnDefinitions, filterState, columnVisibility, rowSelection, cellEditState) plus the orchestrator `index.tsx`, which keeps renderCell, renderHeader, all action handlers, and the return statement. No sub-file will exceed 300 lines. The orchestrator will be the heaviest file at approximately 260 lines.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (project-installed) | useState, useMemo, useEffect, useRef, useCallback | All hook primitives — not optional |
| TypeScript | 5.8.2 (per STATE.md) | Interface exports, type safety | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | project-installed | ChevronUp, ChevronDown, ChevronsUpDown, GripVertical icons | Only in renderHeader (stays in orchestrator) |
| @/components/ui/select | project-installed | Select dropdown for cell editing | Only in renderCell (stays in orchestrator) |

**No new packages required.** This is a pure structural refactor — zero new dependencies.

---

## Architecture Patterns

### Recommended Project Structure

```
hooks/
└── useDoorTableState/
    ├── index.tsx              # orchestrator barrel (~260 lines)
    ├── columnDefinitions.ts   # types + constants (~100 lines)
    ├── filterState.tsx        # filter/search/sort hook (~100 lines)
    ├── columnVisibility.tsx   # column prefs + custom columns hook (~155 lines)
    ├── rowSelection.tsx       # row selection + modal state hook (~60 lines)
    └── cellEditState.tsx      # editing cell + tempValue + inputRef hook (~55 lines)
```

---

### Pattern 1: Orchestrator Hook (index.tsx)

The orchestrator calls all sub-hooks, receives their returns, and assembles a single flat return object. It also owns all action handlers (handleAssignHardware, handleAssignAll, handleAddDoor, handleDeleteSelected, handleDeleteRow, handleDoorSave, etc.) and renderCell/renderHeader, because they close over state from multiple sub-hooks simultaneously.

**Example structure:**
```typescript
'use client';
// index.tsx — orchestrator
import { useFilterState } from './filterState';
import { useColumnVisibility } from './columnVisibility';
import { useRowSelection } from './rowSelection';
import { useCellEditState } from './cellEditState';
// column definitions are pure constants — imported directly, not called as hooks
import { ALL_AVAILABLE_COLUMNS, DOOR_SECTION_KEYS, FRAME_SECTION_KEYS,
         HARDWARE_SECTION_KEYS, formatDimension } from './columnDefinitions';

export function useDoorTableState(params: UseDoorTableStateParams) {
    const filterState = useFilterState(params);
    const colVis = useColumnVisibility({ projectId: params.projectId });
    const rowSel  = useRowSelection();
    const editState = useCellEditState();

    // ... action handlers + renderCell + renderHeader here

    return {
        ...filterState,
        ...colVis,
        ...rowSel,
        ...editState,
        // handlers + render functions
    };
}

export { default } from './index';  // VER-03: explicit default re-export
// NOTE: useDoorTableState has no default export in the current file.
// VER-03 is N/A per Phase 9 precedent — no default to re-export.
```

**VER-03 applicability:** The current flat file has no `export default`. Phase 9 precedent (excelExportService) confirms VER-03 is marked N/A when there is no default export. The ROADMAP success criterion for Phase 10 still says "every barrel `index.tsx` explicitly re-exports the default export via `export { default } from './File'`" — but this applies only if a sub-file introduces a default export (none will). The planner should document this N/A decision explicitly.

---

### Pattern 2: columnDefinitions.ts — Pure Constants (no hooks)

**Lines in source:** 1–98 (interfaces, type aliases, constants, formatDimension)

This file is pure TypeScript — no React hooks, no browser APIs. It must NOT carry `'use client'` (per VER-02, the directive is only required when hooks or browser APIs are used). It exports as `.ts` not `.tsx` since it contains no JSX.

**Contents:**
- `ColumnDef` interface (lines 11–19)
- `CustomColumn` interface (lines 21–25)
- `PersistedColumnPrefs` interface (lines 27–31)
- `StatusFilter` type alias (line 33)
- `formatDimension` function (lines 35–40)
- `ALL_AVAILABLE_COLUMNS` array (lines 42–84)
- `DOOR_SECTION_KEYS` Set (lines 86–89)
- `FRAME_SECTION_KEYS` Set (lines 90–96)
- `HARDWARE_SECTION_KEYS` Set (lines 95–97)

All of these must be re-exported from `index.tsx` because `DoorTableRow.tsx`, `DoorTableHeader.tsx`, and `DoorScheduleManager.tsx` import them directly from `../../hooks/useDoorTableState`.

**Estimated line count:** ~100 lines. Well within 300-line limit.

---

### Pattern 3: filterState.tsx — Filter/Search/Sort Hook

**Lines in source:** 124–128 (state), 132–133 (sortConfig), 254–339 (derived values + filteredAndSortedDoors)

**Hooks used:** `useState`, `useMemo`
**Must carry `'use client'`:** YES (uses useState/useMemo)

**State managed:**
- `statusFilter`, `setStatusFilter`
- `doorMaterialFilter`, `setDoorMaterialFilter`
- `frameMaterialFilter`, `setFrameMaterialFilter`
- `searchQuery`, `setSearchQuery`
- `sortConfig`, `setSortConfig`

**Derived values (useMemo):**
- `statusCounts` (lines 254–261)
- `uniqueDoorMaterials` (lines 262–267)
- `uniqueFrameMaterials` (lines 268–273)
- `filteredAndSortedDoors` (lines 282–339)

**Handler:**
- `handleSort` (lines 274–280)

**Parameters needed from parent:** `doors: Door[]` (for filtered/sorted results)

**Returns:** statusFilter, setStatusFilter, doorMaterialFilter, setDoorMaterialFilter, frameMaterialFilter, setFrameMaterialFilter, searchQuery, setSearchQuery, sortConfig, handleSort, statusCounts, uniqueDoorMaterials, uniqueFrameMaterials, filteredAndSortedDoors

**Estimated line count:** ~100 lines.

---

### Pattern 4: columnVisibility.tsx — Column Prefs + Custom Columns Hook

**Lines in source:** 139–147 (state), 174–238 (localStorage load effect), 227–238 (localStorage save effect), 539–629 (derived + handlers)

**Hooks used:** `useState`, `useMemo`, `useEffect`
**Uses browser API:** `window.localStorage`
**Must carry `'use client'`:** YES

**State managed:**
- `visibleColumns`, `setVisibleColumns`
- `columnOrder`, `setColumnOrder`
- `dragOverKey`, `setDragOverKey`
- `dragSourceKey` (useRef)
- `customColumns`, `setCustomColumns`
- `isColumnCustomizerOpen`, `setIsColumnCustomizerOpen`
- `newColumnName`, `setNewColumnName`
- `newColumnType`, `setNewColumnType`
- `columnPrefsLoaded`, `setColumnPrefsLoaded`

**Derived values:**
- `orderedColumns` useMemo (lines 539–542)
- `allSelectableColumnKeys` useMemo (lines 588–591)
- `areAllColumnsSelected` derived boolean (lines 593–595)

**Handlers:**
- `handleColDragStart` (lines 544–547)
- `handleColDragOver` (lines 549–555)
- `handleColDrop` (lines 557–572)
- `handleColDragEnd` (lines 574–577)
- `toggleColumn` (lines 579–586)
- `toggleAllColumns` (lines 596–602)
- `addCustomColumn` (lines 604–620)
- `removeCustomColumn` (lines 622–629)

**Parameters needed from parent:** `projectId: string`, `addToast` (for addCustomColumn warning)

**Estimated line count:** ~155 lines (heaviest sub-file, safely under 300).

---

### Pattern 5: rowSelection.tsx — Row Selection + Modal State Hook

**Lines in source:** 149–152 (state)

**Hooks used:** `useState`, `useEffect` (filter menu close handler, lines 240–252)
**Uses browser API:** `document.addEventListener`
**Must carry `'use client'`:** YES

**State managed:**
- `selectedRows`, `setSelectedRows`
- `reportModalOpen`, `setReportModalOpen`
- `isFilterMenuOpen`, `setIsFilterMenuOpen`
- `filterMenuRef` (useRef)

**Handlers:**
- `toggleSelectAll` (lines 427–433) — depends on `filteredAndSortedDoors` from filterState
- `toggleRowSelection` (lines 435–440)

**Note:** `toggleSelectAll` needs `filteredAndSortedDoors` passed as a parameter. This is the primary cross-sub-hook dependency. The orchestrator passes it in.

**Parameters needed from parent:** `filteredAndSortedDoors: Door[]` (for toggleSelectAll length check)

**Estimated line count:** ~60 lines.

---

### Pattern 6: cellEditState.tsx — Cell Edit + Temp Value Hook

**Lines in source:** 130–131 (state), 134 (inputRef), 168–172 (focus effect)

**Hooks used:** `useState`, `useRef`, `useEffect`
**Must carry `'use client'`:** YES

**State managed:**
- `editingCell`, `setEditingCell`
- `tempValue`, `setTempValue`
- `inputRef`

**Handlers:**
- `startEditing` (lines 442–445)
- `cancelEditing` (lines 447–450)
- `saveEdit` (lines 452–529) — NOTE: saveEdit closes over `onDoorsUpdate`, `onProvidedSetChange`, `editingCell`, `tempValue`
- `handleKeyDown` (lines 531–537)

**Critical note on saveEdit:** `saveEdit` closes over `editingCell`, `tempValue`, `onDoorsUpdate`, `onProvidedSetChange` from the parent params. This is a closure-at-call-site dependency. The sub-hook must accept `onDoorsUpdate` and `onProvidedSetChange` as parameters.

**Parameters needed from parent:** `onDoorsUpdate`, `onProvidedSetChange` (from original UseDoorTableStateParams)

**Estimated line count:** ~55 lines.

---

### Pattern 7: Orchestrator index.tsx — What Stays

The orchestrator retains:
- Import of all sub-hooks and columnDefinitions
- The `UseDoorTableStateParams` interface
- All action handlers that depend on multiple sub-hook states: `handleAssignHardware`, `handleAssignAll`, `handleAddDoor`, `handleDeleteSelected`, `handleDeleteRow`, `handleDoorSave`
- Upload error derived state (lines 154–162: `lastErrorTask`, `hasUploadErrors`, `hasRowErrors`, `validSetNames`, `isAssigningBatch`)
- `renderCell` (lines 680–775) — closes over editingCell, tempValue, inputRef, handleKeyDown, saveEdit, onDoorsUpdate
- `renderHeader` (lines 786–820) — closes over visibleColumns, dragOverKey, handleColDragStart/Over/Drop/End, handleSort, sortConfig
- `SortIcon` component (lines 777–784)
- The full return statement

**Named exports the barrel must re-export** (for call-site compatibility without modification):
- `useDoorTableState` (function — the orchestrator itself)
- `ALL_AVAILABLE_COLUMNS` (from columnDefinitions)
- `ColumnDef` (interface — from columnDefinitions)
- `CustomColumn` (interface — from columnDefinitions)
- `PersistedColumnPrefs` (interface — from columnDefinitions)
- `StatusFilter` (type — from columnDefinitions)
- `formatDimension` (function — from columnDefinitions)
- `DOOR_SECTION_KEYS` (Set — from columnDefinitions)
- `FRAME_SECTION_KEYS` (Set — from columnDefinitions)
- `HARDWARE_SECTION_KEYS` (Set — from columnDefinitions)

**Estimated orchestrator line count:** ~260 lines (imports + retained state/handlers + renderCell + renderHeader + return). Within the 300-line limit.

---

### Complete Return Value Inventory (55 items)

The return statement occupies lines 823–881. All 59 items in the return object (requirement says "55+"):

| # | Return Value | Type | Provided By |
|---|-------------|------|-------------|
| 1 | statusFilter | StatusFilter | filterState |
| 2 | setStatusFilter | Dispatch | filterState |
| 3 | doorMaterialFilter | string | filterState |
| 4 | setDoorMaterialFilter | Dispatch | filterState |
| 5 | frameMaterialFilter | string | filterState |
| 6 | setFrameMaterialFilter | Dispatch | filterState |
| 7 | searchQuery | string | filterState |
| 8 | setSearchQuery | Dispatch | filterState |
| 9 | isAssigningBatch | boolean | orchestrator |
| 10 | editingCell | {id, field} \| null | cellEditState |
| 11 | tempValue | string \| number | cellEditState |
| 12 | sortConfig | {key, direction} \| null | filterState |
| 13 | inputRef | RefObject | cellEditState |
| 14 | editModalDoor | Door \| null | orchestrator (handleAddDoor, handleDoorSave) |
| 15 | setEditModalDoor | Dispatch | orchestrator |
| 16 | savingDoorId | string \| null | orchestrator |
| 17 | visibleColumns | Set\<string\> | columnVisibility |
| 18 | setVisibleColumns | Dispatch | columnVisibility |
| 19 | columnOrder | string[] | columnVisibility |
| 20 | dragOverKey | string \| null | columnVisibility |
| 21 | customColumns | CustomColumn[] | columnVisibility |
| 22 | isColumnCustomizerOpen | boolean | columnVisibility |
| 23 | setIsColumnCustomizerOpen | Dispatch | columnVisibility |
| 24 | newColumnName | string | columnVisibility |
| 25 | setNewColumnName | Dispatch | columnVisibility |
| 26 | newColumnType | 'text' \| 'number' | columnVisibility |
| 27 | setNewColumnType | Dispatch | columnVisibility |
| 28 | columnPrefsLoaded | boolean | columnVisibility |
| 29 | selectedRows | Set\<string\> | rowSelection |
| 30 | reportModalOpen | boolean | rowSelection |
| 31 | setReportModalOpen | Dispatch | rowSelection |
| 32 | isFilterMenuOpen | boolean | rowSelection |
| 33 | setIsFilterMenuOpen | Dispatch | rowSelection |
| 34 | filterMenuRef | RefObject | rowSelection |
| 35 | lastErrorTask | Task \| undefined | orchestrator |
| 36 | hasUploadErrors | boolean | orchestrator |
| 37 | hasRowErrors | boolean | orchestrator |
| 38 | validSetNames | Set\<string\> | orchestrator |
| 39 | statusCounts | Record | filterState |
| 40 | uniqueDoorMaterials | string[] | filterState |
| 41 | uniqueFrameMaterials | string[] | filterState |
| 42 | filteredAndSortedDoors | Door[] | filterState |
| 43 | orderedColumns | ColumnDef[] | columnVisibility |
| 44 | allSelectableColumnKeys | string[] | columnVisibility |
| 45 | areAllColumnsSelected | boolean | columnVisibility |
| 46 | handleSort | function | filterState |
| 47 | handleAssignHardware | function | orchestrator |
| 48 | handleAssignAll | function | orchestrator |
| 49 | handleAddDoor | function | orchestrator |
| 50 | handleDeleteSelected | function | orchestrator |
| 51 | handleDeleteRow | function | orchestrator |
| 52 | toggleSelectAll | function | rowSelection |
| 53 | toggleRowSelection | function | rowSelection |
| 54 | startEditing | function | cellEditState |
| 55 | cancelEditing | function | cellEditState |
| 56 | saveEdit | function | cellEditState |
| 57 | handleKeyDown | function | cellEditState |
| 58 | handleColDragStart | function | columnVisibility |
| 59 | handleColDragOver | function | columnVisibility |
| 60 | handleColDrop | function | columnVisibility |
| 61 | handleColDragEnd | function | columnVisibility |
| 62 | toggleColumn | function | columnVisibility |
| 63 | toggleAllColumns | function | columnVisibility |
| 64 | addCustomColumn | function | columnVisibility |
| 65 | removeCustomColumn | function | columnVisibility |
| 66 | handleDoorSave | function | orchestrator |
| 67 | renderCell | function | orchestrator (HOOK-03: must stay here) |
| 68 | renderHeader | function | orchestrator (HOOK-03: must stay here) |

**Total: 68 return values** (well above the 55+ threshold in HOOK-02).

---

### Call Sites — Exact Named Import Requirements

Three files in the main project (excluding .claude/worktrees which are agent copies):

**1. `components/doorSchedule/DoorScheduleManager.tsx` (line 9)**
```typescript
import { useDoorTableState, ALL_AVAILABLE_COLUMNS, StatusFilter } from '../../hooks/useDoorTableState';
```
Needs: `useDoorTableState`, `ALL_AVAILABLE_COLUMNS`, `StatusFilter`

**2. `components/doors/DoorTableHeader.tsx` (line 4)**
```typescript
import { ColumnDef, CustomColumn } from '../../hooks/useDoorTableState';
```
Needs: `ColumnDef`, `CustomColumn`

**3. `components/doors/DoorTableRow.tsx` (line 4)**
```typescript
import { ColumnDef, CustomColumn, DOOR_SECTION_KEYS, FRAME_SECTION_KEYS, HARDWARE_SECTION_KEYS } from '../../hooks/useDoorTableState';
```
Needs: `ColumnDef`, `CustomColumn`, `DOOR_SECTION_KEYS`, `FRAME_SECTION_KEYS`, `HARDWARE_SECTION_KEYS`

**All nine named exports required** from the barrel: `useDoorTableState`, `ALL_AVAILABLE_COLUMNS`, `StatusFilter`, `ColumnDef`, `CustomColumn`, `DOOR_SECTION_KEYS`, `FRAME_SECTION_KEYS`, `HARDWARE_SECTION_KEYS`. The `PersistedColumnPrefs`, `formatDimension` exports are not consumed externally but must be preserved in case future callers depend on them.

---

### Dependency Flow Between Sub-Files

```
columnDefinitions.ts   (pure, no deps on other sub-files)
       ↑ imported by:
filterState.tsx        ← needs Door[] type only (from types/)
columnVisibility.tsx   ← needs ALL_AVAILABLE_COLUMNS (from columnDefinitions)
rowSelection.tsx       ← needs filteredAndSortedDoors (passed as param from orchestrator)
cellEditState.tsx      ← needs onDoorsUpdate, onProvidedSetChange (passed as params)
index.tsx (orchestrator) ← imports all sub-hooks + columnDefinitions
```

**No circular dependencies** exist in this structure. All data flows one direction: columnDefinitions → sub-hooks → orchestrator.

---

### Anti-Patterns to Avoid

- **Splitting renderCell/renderHeader out:** These functions close over `editingCell`, `tempValue`, `inputRef`, `handleKeyDown`, `saveEdit`, `onDoorsUpdate`, `visibleColumns`, `dragOverKey`, and multiple drag handlers — state from at least four different sub-hooks. Extracting them would require passing all those values as arguments or creating a complex context, violating the zero-behavior-change constraint.
- **Splitting saveEdit into cellEditState and then calling it from the orchestrator as a callback:** The current saveEdit directly calls `onDoorsUpdate` and `onProvidedSetChange` which come from the outer params. Keeping saveEdit in cellEditState.tsx requires those params to be passed into the sub-hook — this is the correct approach. Do NOT restructure saveEdit to be defined in the orchestrator and injected as a callback.
- **Using export \* from sub-files in the barrel:** VER-03 compliance requires explicit named re-exports. Use `export { ... } from './file'` for each named export.
- **Omitting 'use client' from sub-files that use hooks:** All four hook sub-files (filterState, columnVisibility, rowSelection, cellEditState) use React hooks — all four need `'use client'` as the literal first line. columnDefinitions.ts has no hooks, no browser APIs — do NOT add `'use client'` to it.
- **Adding .tsx extension to columnDefinitions:** This file contains no JSX. Use `.ts` extension to signal purity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column pref persistence | Custom serialization | Existing localStorage code (move as-is) | Already handles edge cases (stale keys, missing defaults, custom column merge) |
| Cross-sub-hook state sharing | React Context or Zustand | Pass as parameters to sub-hooks from orchestrator | The orchestrator owns composition — no new state management layer needed |
| Export compatibility shim | Custom module proxy | TypeScript barrel re-exports | Plain `export { X } from './file'` is sufficient; no runtime overhead |

---

## Common Pitfalls

### Pitfall 1: Breaking the Filter Menu Click-Outside Handler
**What goes wrong:** The filter menu `useEffect` (lines 240–252) uses `document.addEventListener` and `filterMenuRef`. If rowSelection.tsx moves `filterMenuRef` but the orchestrator keeps `isFilterMenuOpen`, the effect breaks because it needs both in scope.
**Why it happens:** The effect depends on both `isFilterMenuOpen` (guard) and `filterMenuRef` (target check) — they must live in the same file.
**How to avoid:** Keep `isFilterMenuOpen`, `setIsFilterMenuOpen`, `filterMenuRef`, and the click-outside `useEffect` all in `rowSelection.tsx` together.

### Pitfall 2: columnPrefsLoaded localStorage Save Guard
**What goes wrong:** The save `useEffect` (lines 227–238) has `if (!columnPrefsLoaded || ...) return` — if the guard state moves to a different file from the save effect, the guard stops working.
**Why it happens:** `columnPrefsLoaded` is set in the load effect and read in the save effect; both must live in `columnVisibility.tsx`.
**How to avoid:** All localStorage-related state and effects must stay together in `columnVisibility.tsx`.

### Pitfall 3: Stale Return Value Names
**What goes wrong:** Orchestrator spreads sub-hook returns (`...filterState`) but a sub-hook renames a property; call sites that destructure by name break.
**Why it happens:** `export *` spreads make renaming invisible.
**How to avoid:** Keep sub-hook return property names identical to the original flat hook names. No renaming — structural refactor only.

### Pitfall 4: editModalDoor and savingDoorId Ownership
**What goes wrong:** These two state values (`editModalDoor`, `setEditModalDoor`, `savingDoorId`, `setSavingDoorId`) are used by `handleAddDoor` and `handleDoorSave` in the orchestrator. If they are moved to a sub-hook, the orchestrator loses direct access to the setters.
**Why it happens:** They straddle the boundary between "modal state" and "action handlers."
**How to avoid:** Keep `editModalDoor` and `savingDoorId` state in the orchestrator `index.tsx` — they are action-handler-owned state, not a cohesive domain on their own. They are NOT moved to rowSelection.tsx.

### Pitfall 5: VER-03 N/A Misapplication
**What goes wrong:** Planner adds a spurious `export { default } from './file'` to the barrel when no sub-file has a default export, causing a TypeScript error.
**Why it happens:** VER-03 reads as always-required.
**How to avoid:** VER-03 applies only when a default export exists. This hook has no default export (neither does any sub-file). Document explicitly as "VER-03 N/A — no default export" per Phase 9 precedent.

### Pitfall 6: 'use client' on columnDefinitions.ts
**What goes wrong:** Adding `'use client'` to `columnDefinitions.ts` (which has no hooks) triggers a lint warning or confuses VER-02 audits.
**Why it happens:** Applying the directive by default without checking for actual hook/browser API usage.
**How to avoid:** VER-02 says the directive is required when hooks or browser APIs are present. `columnDefinitions.ts` has neither — omit the directive.

---

## Line Count Estimates per Sub-File

| File | Estimated Lines | Basis |
|------|----------------|-------|
| `columnDefinitions.ts` | ~100 | Lines 11–98 of source + file header |
| `filterState.tsx` | ~100 | State declarations + 4 useMemo + handleSort + hook signature/return |
| `columnVisibility.tsx` | ~155 | State declarations + 2 useEffect (localStorage) + 9 handlers/derived |
| `rowSelection.tsx` | ~60 | State declarations + 1 useEffect + 2 handlers |
| `cellEditState.tsx` | ~55 | State declarations + 1 useEffect + 4 handlers |
| `index.tsx` (orchestrator) | ~260 | Imports + retained state + 6 action handlers + renderCell + renderHeader + SortIcon + return |
| **Total** | **~730** | Source is 883 lines; reduction from removing duplication/comments in split |

All sub-files are comfortably under 300 lines. The orchestrator at ~260 lines is the largest.

---

## Difference from Phase 8 (Component Split)

| Concern | Phase 8 (Component) | Phase 10 (Hook) |
|---------|-------------------|----------------|
| Default export | Yes — React components have default exports | No — hook has no default export; VER-03 N/A |
| 'use client' scope | Components with hooks need it | All sub-files that call React hooks need it |
| Sub-file extension | `.tsx` (JSX in components) | Mix: `.ts` for pure types, `.tsx` for hook files (no JSX except orchestrator) |
| Import path resolution | `../../hooks/useDoorTableState` resolves to directory index | Same — Next.js/TypeScript resolves `hooks/useDoorTableState` to `hooks/useDoorTableState/index.tsx` |
| Public API preservation | Named exports from barrel match original | Same — all 9 externally-imported names must be in barrel |
| Barrel purpose | Component-as-barrel (D-14 decision in Phase 8) | Sub-hook orchestrator — not the same pattern; index.tsx IS the hook |

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code/structural changes with no external dependencies beyond the existing project toolchain (TypeScript, Node.js, Next.js) all confirmed operational by Phase 9 completion.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (tsc --noEmit) |
| Config file | tsconfig.json (project root) |
| Quick run command | `npx tsc --noEmit 2>&1` |
| Full suite command | `npx tsc --noEmit 2>&1` |

No automated test files exist for this hook. VER-01 (tsc diff), VER-02 ('use client' audit), VER-03 (explicit default re-export) are the verification gates.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOOK-01 | Sub-directory structure created, no sub-file > 300 lines | manual line count | `wc -l hooks/useDoorTableState/*.ts hooks/useDoorTableState/*.tsx` | N/A — structural check |
| HOOK-02 | All 68 return values in public interface; call sites compile | unit (tsc) | `npx tsc --noEmit 2>&1` | ✅ existing tsconfig |
| HOOK-03 | renderCell and renderHeader are in index.tsx only | manual grep | `grep -n "renderCell\|renderHeader" hooks/useDoorTableState/*.tsx` | N/A — structural check |
| VER-01 | Zero new TS2305/TS2307/TS2306 errors vs baseline | tsc diff | diff against .planning/tsc-baseline.txt | ✅ baseline exists |
| VER-02 | All hook sub-files have 'use client' first line | manual grep | `head -1 hooks/useDoorTableState/filterState.tsx hooks/useDoorTableState/columnVisibility.tsx hooks/useDoorTableState/rowSelection.tsx hooks/useDoorTableState/cellEditState.tsx hooks/useDoorTableState/index.tsx` | N/A — structural check |
| VER-03 | N/A — no default export | — | document explicitly as N/A | — |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit 2>&1 | head -30`
- **Per wave merge:** Full tsc output diff against baseline
- **Phase gate:** Full tsc diff green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure (tsc + manual grep) covers all phase requirements.

---

## Sources

### Primary (HIGH confidence)
- Direct source read of `hooks/useDoorTableState.tsx` (883 lines, full file)
- Direct read of `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`
- Direct read of `components/doorSchedule/DoorScheduleManager.tsx` (import lines)
- Direct read of `components/doors/DoorTableHeader.tsx` (import lines)
- Direct read of `components/doors/DoorTableRow.tsx` (import lines)
- Direct read of `services/excelExportService/index.ts` (Phase 9 barrel pattern reference)
- Direct read of `components/doorSchedule/DoorScheduleConfig/index.tsx` (Phase 8 orchestrator pattern reference)
- `.planning/tsc-baseline.txt` — confirmed present; current tsc errors are all pre-existing (baseline)

### Secondary (MEDIUM confidence)
- STATE.md Key Decisions table — Phase 9 decisions confirming VER-03 N/A pattern and 'use client' placement rules

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing React/TypeScript only
- Architecture: HIGH — complete line-level domain mapping from source read; all 68 return values enumerated from actual return statement
- Pitfalls: HIGH — all pitfalls derived from direct source analysis (closure dependencies, guard conditions, state ownership)

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (file is not under active development)
