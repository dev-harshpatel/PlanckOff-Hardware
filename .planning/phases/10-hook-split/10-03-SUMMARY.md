---
phase: 10-hook-split
plan: 03
subsystem: hooks
tags: [hook-split, orchestrator, barrel, typescript]
dependency_graph:
  requires:
    - 10-01 (columnDefinitions.ts + filterState.tsx)
    - 10-02 (columnVisibility.tsx + rowSelection.tsx + cellEditState.tsx)
  provides:
    - hooks/useDoorTableState/index.tsx (orchestrator + barrel)
  affects:
    - components/doorSchedule/DoorScheduleManager.tsx (consumer, unmodified)
    - components/doors/DoorTableHeader.tsx (consumer, unmodified)
    - components/doors/DoorTableRow.tsx (consumer, unmodified)
tech_stack:
  added: []
  patterns:
    - directory-index resolution (TypeScript resolves hooks/useDoorTableState to index.tsx)
    - orchestrator pattern (single hook assembles 4 sub-hooks + own state)
    - barrel re-exports (export {} from './sub-file' for call-site compatibility)
key_files:
  created:
    - hooks/useDoorTableState/index.tsx
  modified:
    - hooks/useDoorTableState/rowSelection.tsx (expose setSelectedRows in return)
    - hooks/useDoorTableState/columnVisibility.tsx (fix addToast param type)
  deleted:
    - hooks/useDoorTableState.tsx (original 882-line flat file)
decisions:
  - "renderCell and renderHeader kept in index.tsx (HOOK-03): they close over editState, colVis, filterState simultaneously — extracting would require prop-drilling 15+ values"
  - "setSelectedRows exposed from rowSelection return: orchestrator handleDeleteSelected/handleDeleteRow need to reset selection after mutation"
  - "addToast param type in columnVisibility corrected to Omit<Toast, 'id'>: sub-hook callers never provide id field; original type was incorrect"
  - "VER-03 N/A: no sub-file has a default export; named-export barrel satisfies all consumers"
metrics:
  duration: ~7 min
  completed: "2026-05-14"
  tasks: 2
  files: 4
---

# Phase 10 Plan 03: useDoorTableState Orchestrator Summary

**One-liner:** Orchestrator hook index.tsx wires 4 sub-hooks (filterState, columnVisibility, rowSelection, cellEditState), keeps renderCell/renderHeader per HOOK-03, re-exports 9 named symbols as barrel; flat file deleted; VER-01/02/03 all PASS.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create hooks/useDoorTableState/index.tsx (orchestrator) | db288af | hooks/useDoorTableState/index.tsx |
| 2 | Verify tsc, run VER gates, delete flat file | e877227 | hooks/useDoorTableState.tsx (deleted) |
| - | Fix type mismatches found during VER gates | abbb9f5 | rowSelection.tsx, columnVisibility.tsx, index.tsx |

## What Was Built

`hooks/useDoorTableState/index.tsx` (244 lines) — orchestrator hook that:
- Has `'use client'` as literal first line
- Imports all 4 sub-hooks from sibling files
- Keeps `renderCell` and `renderHeader` in this file (HOOK-03: they close over editState + colVis + filterState simultaneously)
- Assembles a single flat return object spreading all 4 sub-hook returns plus 16 orchestrator-owned values
- Barrel re-exports 9 external-consumer-required symbols so all 3 call sites compile without import path changes

`hooks/useDoorTableState.tsx` — deleted after VER-01 confirmation.

## VER Gate Results

| Gate | Status | Detail |
|------|--------|--------|
| VER-01 | PASS | Zero new TS2305/TS2307/TS2306 errors after flat file deletion; all 9 TS2305 errors are pre-existing baseline |
| VER-02 | PASS | index.tsx, filterState.tsx, columnVisibility.tsx, rowSelection.tsx, cellEditState.tsx all have 'use client' as first line; columnDefinitions.ts correctly omits directive |
| VER-03 | N/A | Zero default exports in sub-directory; documented as comment in index.tsx per Phase 9 precedent |
| HOOK-01 | PASS | All 6 files under 300 lines (max: index.tsx 244 lines) |
| HOOK-02 | PASS | All 68 return values in public interface; 3 call sites (DoorScheduleManager, DoorTableHeader, DoorTableRow) compile without modification |
| HOOK-03 | PASS | renderCell and renderHeader defined only in index.tsx; grep of all 5 sub-files returns zero matches |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] setSelectedRows not exported from rowSelection.tsx**
- **Found during:** Task 2 VER gates
- **Issue:** rowSelection.tsx return object did not include `setSelectedRows`; orchestrator `handleDeleteSelected` and `handleDeleteRow` reference `rowSel.setSelectedRows()` to reset selection after mutations
- **Fix:** Added `setSelectedRows` to the return statement of rowSelection.tsx
- **Files modified:** hooks/useDoorTableState/rowSelection.tsx
- **Commit:** abbb9f5

**2. [Rule 1 - Bug] columnVisibility.tsx addToast param type incorrect**
- **Found during:** Task 2 VER gates (tsc exposed TS2345)
- **Issue:** `UseColumnVisibilityParams.addToast` typed as `(toast: Toast) => void` but callers pass `{ type, message }` without `id` field; causes TS2345 errors
- **Fix:** Changed to `(toast: Omit<Toast, 'id'>) => void`; removed unnecessary type cast from index.tsx
- **Files modified:** hooks/useDoorTableState/columnVisibility.tsx, hooks/useDoorTableState/index.tsx
- **Commit:** abbb9f5

**3. [Rule 1 - Bug] Unused ERRORS import in index.tsx**
- **Found during:** Task 2 cleanup
- **Issue:** `ERRORS` from '@/constants/errors' was imported in index.tsx but not used (the only usage moved to columnVisibility.tsx in Plan 10-02)
- **Fix:** Removed the unused import line
- **Files modified:** hooks/useDoorTableState/index.tsx
- **Commit:** abbb9f5

## Known Stubs

None — all return values are wired to real sub-hook state and action handlers. No placeholder values.

## Sub-directory Structure (Final)

| File | Lines | Purpose |
|------|-------|---------|
| index.tsx | 244 | Orchestrator + barrel |
| columnDefinitions.ts | 87 | Pure constants (no 'use client') |
| filterState.tsx | 116 | Filter/sort state |
| columnVisibility.tsx | 204 | Column prefs + localStorage |
| rowSelection.tsx | 53 | Row selection + filter menu |
| cellEditState.tsx | 127 | Inline cell editing |

## Self-Check: PASSED
