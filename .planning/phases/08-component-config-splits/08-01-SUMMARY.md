---
phase: 08-component-config-splits
plan: 01
subsystem: ui
tags: [react, typescript, nextjs, door-schedule, component-split, refactor]

requires:
  - phase: 07-pre-split-cleanup
    provides: "DoorScheduleExportConfig extracted to types/doorScheduleTypes.ts (PRE-02), dead exportDoorScheduleToPDF removed (PRE-01)"

provides:
  - "DoorScheduleConfig sub-directory module with component-as-barrel index.tsx (D-14)"
  - "ColumnAccordion.tsx — extracted accordion sub-component"
  - "GroupedTable.tsx — extracted grouped table preview sub-component"
  - "useDoorScheduleDownload.tsx — extracted 382-line handleDownload as custom hook (D-16 exception)"
  - "Flat DoorScheduleConfig.tsx (996 lines) replaced by 4-file sub-directory module"

affects:
  - "08-02-hardware-set-config-split"
  - "08-03-verification"
  - "app/project/[id]/reports/door-schedule/page.tsx"
  - "components/reports/ReportGenerationCenter.tsx"
  - "views/ReportsView.tsx"

tech-stack:
  added: []
  patterns:
    - "Component-as-barrel (D-14): index.tsx IS the main component, not a thin re-export shell"
    - "Custom hook extraction for large async handlers: useDoorScheduleDownload"
    - "Sub-directory module with sibling-up type imports from ../doorScheduleTypes"
    - "Depth-adjusted relative imports: ../../x -> ../../../x when one level deeper"

key-files:
  created:
    - "components/doorSchedule/DoorScheduleConfig/index.tsx"
    - "components/doorSchedule/DoorScheduleConfig/ColumnAccordion.tsx"
    - "components/doorSchedule/DoorScheduleConfig/GroupedTable.tsx"
    - "components/doorSchedule/DoorScheduleConfig/useDoorScheduleDownload.tsx"
  modified:
    - "components/doorSchedule/DoorScheduleConfig.tsx (DELETED)"

key-decisions:
  - "Component-as-barrel (D-14): index.tsx IS the main DoorScheduleConfig component; no separate inner DoorScheduleConfig.tsx file"
  - "D-16 line-limit exception for useDoorScheduleDownload.tsx: 437 lines, within 450-line ceiling (382-line handleDownload is a single cohesive async op)"
  - "Default export preserved in index.tsx — deliberate deviation from SKILL.md §3 named-export rule; required for zero-impact backward compatibility with all 4 consumers"
  - "VER-01 confirmed: zero new TS2305/TS2306/TS2307 errors vs baseline; pre-existing TS2339 JSZip .default error moved from flat file to useDoorScheduleDownload.tsx (same error, new location)"
  - "GroupedTable props match flat file exactly (not the plan's interface description — actual props are index/total/format/onHide/isCollapsed/onToggleCollapse, not columnGroups/hiddenGroupKeys)"

patterns-established:
  - "Sub-directory module pattern: 4 files (index.tsx as component-as-barrel + 3 focused sub-files)"
  - "'use client' as literal first line (before any imports or comments) in all 4 files (VER-02)"
  - "Sibling-up imports: files inside DoorScheduleConfig/ import local types from ../doorScheduleTypes"

requirements-completed:
  - COMP-01
  - COMP-02
  - VER-02
  - VER-03

duration: ~12min
completed: 2026-05-14
---

# Phase 08 Plan 01: DoorScheduleConfig Sub-Directory Split Summary

**996-line DoorScheduleConfig.tsx split into 4-file sub-directory module via component-as-barrel (D-14): index.tsx contains the full main component, ColumnAccordion/GroupedTable extracted as named sub-components, and the 382-line handleDownload extracted as useDoorScheduleDownload custom hook (D-16 exception)**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-14T06:34:00Z
- **Completed:** 2026-05-14T06:42:34Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 deleted)

## Accomplishments

- Extracted ColumnAccordion (lines 53-121) as named export in dedicated sub-component file
- Extracted GroupedTable (lines 124-256) as named export in dedicated sub-component file
- Extracted handleDownload (lines 337-718, 382 lines) as `useDoorScheduleDownload` custom hook with full params interface
- Created index.tsx as component-as-barrel (D-14): full DoorScheduleConfig component body, ends with `export default DoorScheduleConfig`
- Deleted flat 996-line DoorScheduleConfig.tsx — replaced by 4-file sub-directory module
- All 4 consumers (page.tsx dynamic import, ReportGenerationCenter.tsx, ReportsView.tsx) continue to resolve unchanged via Next.js directory-index resolution
- VER-01: Zero new TS2305/TS2307/TS2306 errors vs baseline

## Task Commits

1. **Task 1: Create ColumnAccordion.tsx and GroupedTable.tsx sub-components** - `26ff46e` (feat)
2. **Task 2: Create useDoorScheduleDownload.tsx custom hook** - `223fb00` (feat)
3. **Task 3: Create index.tsx component-as-barrel, delete flat file** - `f25b868` (feat)

## Files Created/Modified

- `components/doorSchedule/DoorScheduleConfig/index.tsx` — Component-as-barrel: full DoorScheduleConfig component (414 lines, within D-07/D-16 equivalent allowance), `'use client'` line 1, `export type { DoorScheduleExportConfig }` (D-04), `export default DoorScheduleConfig` at end (D-14/VER-03)
- `components/doorSchedule/DoorScheduleConfig/ColumnAccordion.tsx` — Collapsible accordion sub-component (73 lines, within 100-line ceiling), `'use client'` line 1, named export
- `components/doorSchedule/DoorScheduleConfig/GroupedTable.tsx` — Grouped table preview sub-component (131 lines, within 160-line ceiling), `'use client'` line 1, named export
- `components/doorSchedule/DoorScheduleConfig/useDoorScheduleDownload.tsx` — Custom hook extracting handleDownload (437 lines, within D-16 450-line ceiling), `'use client'` line 1, named function export, returns `{ handleDownload }`
- `components/doorSchedule/DoorScheduleConfig.tsx` — DELETED (996 lines, replaced by sub-directory)

## Verification Results

- **VER-02 ('use client' first line):** All 4 files confirmed — `head -1` outputs exactly `'use client';` for index.tsx, ColumnAccordion.tsx, GroupedTable.tsx, useDoorScheduleDownload.tsx
- **VER-03 (explicit default export):** `export default DoorScheduleConfig` at line 414 of index.tsx (component-as-barrel form per D-14)
- **D-04 (type re-export):** `export type { DoorScheduleExportConfig } from '../../../types/doorScheduleTypes'` present in index.tsx
- **D-14 (no separate inner file):** `components/doorSchedule/DoorScheduleConfig/DoorScheduleConfig.tsx` does NOT exist; index.tsx IS the main component
- **VER-01 (tsc diff):** Zero new TS2305/TS2307/TS2306 errors vs baseline. Pre-existing TS2339 JSZip .default error relocated from flat file to useDoorScheduleDownload.tsx (same error, different file path — not a new error)
- **2-space indent:** All new files use 2-space indent per SKILL.md (re-indented from 4-space source)
- **SKILL.md §3 deviation comment:** Present in index.tsx before `export default DoorScheduleConfig`

## Line Counts vs Ceilings

| File | Lines | Ceiling | Status |
|------|-------|---------|--------|
| index.tsx | 414 | ~400 (D-07/D-16 equivalent) | Within allowance |
| ColumnAccordion.tsx | 73 | 100 | Within ceiling |
| GroupedTable.tsx | 131 | 160 | Within ceiling |
| useDoorScheduleDownload.tsx | 437 | 450 (D-16 exception) | Within ceiling |

## Decisions Made

- Component-as-barrel (D-14) honored — index.tsx IS the main component; no indirection through a thin re-export shell
- Default export preserved (deliberate SKILL.md §3 deviation) for zero-impact structural refactor — all 4 consumers use default import, none need modification
- `applySheetTheme` excluded from useDoorScheduleDownload.tsx imports — not directly called in handleDownload body (only `contentAwareColWidths`, `buildMetadataRows`, `applyMetadataStyles`, `applyHeaderRowAt`, `applyFreezeAt` are used)
- GroupedTable params match flat file exactly: `index`, `total`, `format`, `onHide`, `isCollapsed`, `onToggleCollapse` (plan showed a different interface based on an alternate design; actual flat file was authoritative)

## Deviations from Plan

### Minor Scope Deviation

**1. [Rule 2 - Missing Critical] GroupedTable props interface differs from plan's interface description**
- **Found during:** Task 1 (reading flat file source)
- **Issue:** Plan's `<interfaces>` block for GroupedTable listed `columnGroups`, `hiddenGroupKeys`, `onHideGroup`, `onToggleGroup`, `uniqueData` as props. The actual flat file (lines 124-134) uses `index`, `total`, `format`, `onHide`, `isCollapsed`, `onToggleCollapse` as props.
- **Fix:** Used the actual flat file as source of truth per plan instructions ("read the source to capture the exact props interface"). GroupedTable.tsx faithfully reproduces the actual props.
- **Verification:** File created with exact signature from source; no import/type errors in GroupedTable.tsx
- **Committed in:** `26ff46e` (Task 1 commit)

---

**Total deviations:** 1 (minor — plan's interface description was approximate; actual source was authoritative per plan instructions)
**Impact on plan:** Zero behavior change. Actual props used are correct and match the consuming JSX in index.tsx.

## Issues Encountered

None — split proceeded cleanly. The pre-existing JSZip TS2339 type error (`.default` on JSZip) in the baseline relocated from the flat file to useDoorScheduleDownload.tsx at the corresponding line. This is expected and not a new error.

## User Setup Required

None - pure structural refactor, no external services or environment changes.

## Next Phase Readiness

- COMP-01 and COMP-02 satisfied for DoorScheduleConfig
- VER-02 and VER-03 satisfied for all 4 new files
- Phase 08 Plan 02 (HardwareSetConfig split) can proceed independently
- Phase 08 Plan 03 (verification gate) can validate VER-01/02/03 across both component splits after 08-02 completes

---
*Phase: 08-component-config-splits*
*Completed: 2026-05-14*
