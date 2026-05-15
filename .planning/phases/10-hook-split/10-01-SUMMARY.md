---
phase: 10-hook-split
plan: "01"
subsystem: hooks
tags: [hook-split, column-definitions, filter-state, wave-1]
dependency_graph:
  requires: []
  provides:
    - hooks/useDoorTableState/columnDefinitions.ts
    - hooks/useDoorTableState/filterState.tsx
  affects: []
tech_stack:
  added: []
  patterns:
    - Sub-directory hook decomposition (Wave 1 parallel extraction)
    - Pure TypeScript constants file without 'use client'
    - Depth-corrected relative imports for sub-directory files
key_files:
  created:
    - hooks/useDoorTableState/columnDefinitions.ts
    - hooks/useDoorTableState/filterState.tsx
  modified: []
decisions:
  - columnDefinitions.ts uses .ts extension (not .tsx) — no JSX present, VER-02 compliant
  - filterState.tsx has 'use client' as literal first line — uses useState and useMemo
  - hooks/useDoorTableState.tsx flat file left untouched — deletion deferred to plan 10-03
metrics:
  duration: "~2 min"
  completed: "2026-05-14"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
requirements:
  - HOOK-01
  - HOOK-02
---

# Phase 10 Plan 01: Hook Split Wave 1 — columnDefinitions + filterState Summary

**One-liner:** Extracted pure column-definition constants into columnDefinitions.ts (no 'use client', 87 lines) and filter/sort hook into filterState.tsx ('use client' line 1, 116 lines) from the flat useDoorTableState.tsx, leaving the flat file untouched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create hooks/useDoorTableState/columnDefinitions.ts | 56497e7 | hooks/useDoorTableState/columnDefinitions.ts |
| 2 | Create hooks/useDoorTableState/filterState.tsx | 50e5ddd | hooks/useDoorTableState/filterState.tsx |

## Verification Results

- `hooks/useDoorTableState/columnDefinitions.ts`: exists, 87 lines, no 'use client', first line is `export interface ColumnDef {`, all 9 exports present, no React imports
- `hooks/useDoorTableState/filterState.tsx`: exists, 116 lines, `'use client';` as line 1, exports `useFilterState`, imports from `../../types` and `./columnDefinitions`, returns all 14 filter/sort values
- `hooks/useDoorTableState.tsx` flat file: untouched
- tsc check: zero new TS2305/TS2307/TS2306 errors attributed to the new files

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None — both files contain complete, wired logic extracted verbatim from the source flat file.

## Self-Check: PASSED

- `hooks/useDoorTableState/columnDefinitions.ts` exists: FOUND
- `hooks/useDoorTableState/filterState.tsx` exists: FOUND
- Commit 56497e7 exists: FOUND
- Commit 50e5ddd exists: FOUND
