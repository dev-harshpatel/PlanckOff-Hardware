---
phase: 10-hook-split
plan: "02"
subsystem: hooks/useDoorTableState
tags: [hook-split, column-visibility, row-selection, cell-edit, react-hooks, wave-1]
dependency_graph:
  requires: []
  provides:
    - hooks/useDoorTableState/columnVisibility.tsx (useColumnVisibility)
    - hooks/useDoorTableState/rowSelection.tsx (useRowSelection)
    - hooks/useDoorTableState/cellEditState.tsx (useCellEditState)
  affects:
    - hooks/useDoorTableState/index.tsx (plan 10-03 will import these)
tech_stack:
  added: []
  patterns:
    - concern-sliced sub-hook extraction
    - localStorage prefs co-location (load + save effects together)
    - click-outside effect co-location (isFilterMenuOpen + filterMenuRef together)
    - saveEdit closure deps passed as hook params (onDoorsUpdate, onProvidedSetChange)
key_files:
  created:
    - hooks/useDoorTableState/columnVisibility.tsx
    - hooks/useDoorTableState/rowSelection.tsx
    - hooks/useDoorTableState/cellEditState.tsx
  modified: []
decisions:
  - "cellEditState.tsx imports only Door from types — saveEdit body does not use HardwareSet, hardwareSets, matchHardwareSet, migrateDoorData, or ERRORS (confirmed by reading actual saveEdit lines 452-529)"
  - "UseCellEditStateParams interface omits doors and hardwareSets params — not referenced in any handler body; only onDoorsUpdate and onProvidedSetChange are needed"
  - "columnDefinitions TS2307 error expected — plan 10-01 creates that file in a parallel worktree; will resolve when orchestrator (10-03) wires everything"
metrics:
  duration: "~2 minutes"
  completed_date: "2026-05-14"
  tasks: 2
  files: 3
---

# Phase 10 Plan 02: Hook Split Wave 1 (columnVisibility, rowSelection, cellEditState) Summary

Three concern-sliced sub-hooks extracted from `hooks/useDoorTableState.tsx` into the `hooks/useDoorTableState/` sub-directory. Part of Wave 1 parallel extraction alongside plan 10-01 (columnDefinitions + filterState). Flat source file left untouched.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create columnVisibility.tsx | 82533ac | hooks/useDoorTableState/columnVisibility.tsx (204 lines) |
| 2 | Create rowSelection.tsx and cellEditState.tsx | 6cda515 | hooks/useDoorTableState/rowSelection.tsx (53 lines), hooks/useDoorTableState/cellEditState.tsx (127 lines) |

## Artifacts Created

### hooks/useDoorTableState/columnVisibility.tsx (204 lines)
- `'use client'` as literal first line
- Exports `useColumnVisibility({ projectId, addToast })`
- Manages: visibleColumns, columnOrder, dragOverKey, dragSourceKey ref, customColumns, isColumnCustomizerOpen, newColumnName, newColumnType, columnPrefsLoaded
- Both localStorage useEffects co-located (Pitfall 2 guard — columnPrefsLoaded must live with save effect)
- Derived: orderedColumns, allSelectableColumnKeys, areAllColumnsSelected
- Handlers: handleColDragStart, handleColDragOver, handleColDrop, handleColDragEnd, toggleColumn, toggleAllColumns, addCustomColumn, removeCustomColumn
- Imports from `./columnDefinitions` (depth-corrected) and `../../types`

### hooks/useDoorTableState/rowSelection.tsx (53 lines)
- `'use client'` as literal first line
- Exports `useRowSelection({ filteredAndSortedDoors })`
- Manages: selectedRows, reportModalOpen, isFilterMenuOpen, filterMenuRef
- Click-outside useEffect co-located with isFilterMenuOpen and filterMenuRef (Pitfall 1 guard)
- Handlers: toggleSelectAll (uses filteredAndSortedDoors param), toggleRowSelection

### hooks/useDoorTableState/cellEditState.tsx (127 lines)
- `'use client'` as literal first line
- Exports `useCellEditState({ onDoorsUpdate, onProvidedSetChange })`
- Manages: editingCell, tempValue, inputRef
- Focus useEffect co-located with editingCell and inputRef
- Handlers: startEditing, cancelEditing, saveEdit (with onDoorsUpdate/onProvidedSetChange as hook params), handleKeyDown
- Imports: `React` (for React.KeyboardEvent), `Door` from `../../types`

## Verification

- All three files have `'use client'` as literal first line
- All three files are under 300 lines (204, 53, 127)
- `hooks/useDoorTableState.tsx` flat file is unmodified
- Quick tsc check: only new error is `TS2307: Cannot find module './columnDefinitions'` — expected since plan 10-01 runs in parallel and hasn't created that file in this worktree yet
- No editModalDoor, savingDoorId in columnVisibility.tsx
- All other tsc errors are pre-existing baseline errors

## Deviations from Plan

### Decision: cellEditState.tsx imports — saveEdit body analysis

**Found during:** Task 2

**Issue:** Plan action proposed importing `HardwareSet`, `ERRORS`, `matchHardwareSet`, `migrateDoorData` into cellEditState.tsx, and including `doors: Door[]` and `hardwareSets: HardwareSet[]` in the params interface.

**Fix:** After reading saveEdit lines 452-529 verbatim (as instructed: "read the saveEdit body carefully to confirm WHICH imports it actually uses"), none of those are used by saveEdit or handleKeyDown. saveEdit only closes over `editingCell`, `tempValue`, `onDoorsUpdate`, `onProvidedSetChange`. Interface was simplified to only include what is actually referenced.

**Files modified:** hooks/useDoorTableState/cellEditState.tsx

This is a structural accuracy deviation (Rule 1) — including unused imports would be incorrect.

## Known Stubs

None — all logic is verbatim copy from flat file. No placeholder values or stub data.

## Self-Check: PASSED

- hooks/useDoorTableState/columnVisibility.tsx: FOUND (204 lines)
- hooks/useDoorTableState/rowSelection.tsx: FOUND (53 lines)
- hooks/useDoorTableState/cellEditState.tsx: FOUND (127 lines)
- hooks/useDoorTableState.tsx (flat file): FOUND (untouched)
- Commit 82533ac: FOUND
- Commit 6cda515: FOUND
