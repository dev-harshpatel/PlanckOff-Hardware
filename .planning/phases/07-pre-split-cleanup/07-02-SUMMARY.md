---
phase: 07-pre-split-cleanup
plan: 02
subsystem: services
tags: [typescript, excel, dead-code-removal, cleanup]

requires:
  - phase: 07-01
    provides: Export config interfaces extracted to types/ — consumer files already updated

provides:
  - "services/excelExportService.ts without dead exportDoorScheduleToPDF function (lines 710-900 removed)"
  - "Clean 709-line file with only live exports: exportDoorScheduleToExcel, exportHardwareSetToExcel, exportMultiSheetWorkbook"

affects:
  - "09-service-split: excelExportService.ts is now 709 lines, no longer contains dead PDF code"

tech-stack:
  added: []
  patterns: ["Dead code deleted without replacement — live version confirmed in pdfExportService.ts only"]

key-files:
  created: []
  modified:
    - services/excelExportService.ts

key-decisions:
  - "Delete comment + function body (lines 710-900) not just the export keyword — full removal"
  - "Verified zero callers of exportDoorScheduleToPDF from excelExportService before deletion"

patterns-established:
  - "Pre-split cleanup: verify zero callers via grep before deleting dead code"

requirements-completed: [PRE-01]

duration: 5min
completed: 2026-05-13
---

# Phase 7 Plan 02: Delete Dead exportDoorScheduleToPDF from excelExportService Summary

**Deleted 190-line dead PDF function from excelExportService.ts — confirmed zero callers; live version is pdfExportService.ts:123; zero new TypeScript errors.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T00:00:00Z
- **Completed:** 2026-05-13T00:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Removed `exportDoorScheduleToPDF` (lines 710-900) from `services/excelExportService.ts` — the function was unreachable from any call site in the codebase
- Confirmed via grep that `reportExportService.ts` imports `exportDoorScheduleToPDF` exclusively from `./pdfExportService`, never from `./excelExportService`
- Verified zero new TypeScript errors vs `.planning/tsc-baseline.txt`; all pre-existing errors unchanged
- File reduced from 901 lines to 709 lines; all live exports intact

## Task Commits

1. **Task 1: Confirm dead code has zero callers then delete lines 711-900** - `6915926` (fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `services/excelExportService.ts` — Dead `exportDoorScheduleToPDF` function removed (190 lines deleted)

## Deviations from Plan

**Scope clarification:** Plan specified deleting lines 711-900 (the function only). Also deleted line 710 (`// Export Door Schedule to PDF` comment) and the blank line at 709 to leave a clean file ending at the closing `}` of `addProcurementToSheet`. This is consistent with the plan's intent (eliminating the dead block entirely).

Otherwise: plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `services/excelExportService.ts` exists: FOUND
- Function `exportDoorScheduleToPDF` absent from file: CONFIRMED (grep returns zero matches)
- Live exports still present: `exportDoorScheduleToExcel` (line 119), `exportHardwareSetToExcel` (line 262), `exportMultiSheetWorkbook` (line 395)
- File line count: 709 (target ~710)
- Commit `6915926`: FOUND
- Zero new tsc errors vs baseline: CONFIRMED (diff shows only cosmetic changes: line number shifts and type union ordering differences)
