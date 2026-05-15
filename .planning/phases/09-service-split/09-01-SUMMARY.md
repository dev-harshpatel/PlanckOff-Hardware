---
phase: 09-service-split
plan: 01
subsystem: api
tags: [xlsx-js-style, excel, excelExportService, door-schedule, service-split]

# Dependency graph
requires:
  - phase: 07-pre-split-cleanup
    provides: "types/doorScheduleTypes.ts with DoorScheduleExportConfig; utils/exportFilename.ts with buildExportFilename; services/excelExportService.ts reduced to 709 lines"
provides:
  - "services/excelExportService/doorScheduleExcel.ts — door-schedule XLSX generation module with depth-corrected imports"
  - "exportDoorScheduleToExcel public function extracted to sub-directory (Wave 1, Plan 01 of 3)"
affects: [09-02, 09-03, consumers of exportDoorScheduleToExcel]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Sub-directory module extraction — flat file stays until Wave 2 tsc verification (plan 09-03)", "Depth-correct relative imports when moving file one level deeper (add one ../ per path segment)"]

key-files:
  created:
    - services/excelExportService/doorScheduleExcel.ts
  modified: []

key-decisions:
  - "Flat file services/excelExportService.ts NOT deleted — deferred to Wave 2 (plan 09-03) after tsc verification confirms no regressions"
  - "Only door-schedule domain imports included: no saveAs, HardwareSet, HardwareItem, HardwareSetExportConfig, assignDoorCSISection, assignHardwareCSISection"
  - "resolveElevationImageUrl, buildDoorScheduleHeaders, buildDoorScheduleRow kept private (no export keyword)"

patterns-established:
  - "Wave 1 extraction pattern: create sub-directory file, depth-correct imports, keep flat file, verify, delete in Wave 2"

requirements-completed: [SVC-01]

# Metrics
duration: 1min
completed: 2026-05-14
---

# Phase 9 Plan 01: Service Split — Door Schedule Excel Extraction Summary

**Door-schedule XLSX domain extracted from 709-line flat excelExportService.ts into services/excelExportService/doorScheduleExcel.ts (186 lines) with depth-corrected relative import paths**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-14T09:48:14Z
- **Completed:** 2026-05-14T09:49:13Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `services/excelExportService/` sub-directory
- Extracted lines 1-189 (door-schedule domain) from flat `excelExportService.ts` into `doorScheduleExcel.ts`
- Depth-corrected all relative imports: `./excelTheme` → `../excelTheme`, `../types` → `../../types`, `../types/doorScheduleTypes` → `../../types/doorScheduleTypes`, `../utils/exportFilename` → `../../utils/exportFilename`
- Kept `resolveElevationImageUrl`, `buildDoorScheduleHeaders`, `buildDoorScheduleRow` as private functions (no export)
- `exportDoorScheduleToExcel` is the sole exported function
- Flat file `services/excelExportService.ts` left untouched (deletion deferred to plan 09-03)

## Task Commits

1. **Task 1: Create services/excelExportService/doorScheduleExcel.ts** - `e53158e` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified
- `services/excelExportService/doorScheduleExcel.ts` - Door-schedule XLSX generation: resolveElevationImageUrl (private), buildDoorScheduleHeaders (private), buildDoorScheduleRow (private), exportDoorScheduleToExcel (public export)

## Decisions Made
- Flat file not deleted — Wave 2 (plan 09-03) handles deletion after tsc confirms no regressions
- Only door-schedule domain imports included in the sub-file (no file-saver, no HardwareSet types, no CSI utils)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 1 Plan 01 complete — `services/excelExportService/doorScheduleExcel.ts` ready
- Wave 1 Plan 02 (09-02) extracts hardware set Excel domain in parallel
- Wave 2 (09-03) will update all consumers to import from sub-directory files, then delete flat file after tsc verification

---
*Phase: 09-service-split*
*Completed: 2026-05-14*
