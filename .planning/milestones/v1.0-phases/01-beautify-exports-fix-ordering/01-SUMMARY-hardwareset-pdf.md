---
phase: 01-beautify-exports-fix-ordering
plan: 04
subsystem: exports
tags: pdf, jspdf, autotable, hardware-set, ordering

provides:
  - Hardware Set PDF export uses unified pdfTheme (all 3 hardcoded color arrays eliminated)
  - Submittal package cover page uses DEFAULT_THEME
  - ORD-04 guards in reportExportService.ts for both door schedule and hardware set paths

key-files:
  modified:
    - services/pdfExportService.ts
    - services/reportExportService.ts

requirements-completed: [PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, ORD-02, ORD-04]

duration: ~15min
completed: 2026-05-07
---

# Plan 04: Apply PDF Theme to Hardware Set Export — Summary

**Eliminated all three hardcoded color arrays from pdfExportService.ts; wired ORD-04 guards in reportExportService.ts.**

## What Changed

### pdfExportService.ts
- Removed all occurrences of: `[147, 51, 234]` (purple), `[59, 130, 246]` (blue), `[66, 139, 202]` (submittal blue)
- `exportHardwareSetToPDF()`: builds shared `themeOpts` once via `buildAutoTableOptions()`, spreads into flat and grouped autoTable calls
- `exportDoorScheduleToPDF()` (Path B): also uses `buildAutoTableOptions()` + `addPageNumbers()`
- `exportSubmittalPackageToPDF()`: cover page title uses `DEFAULT_THEME.headFill`; door schedule and hardware set sections use `buildAutoTableOptions()`; `addPageNumbers()` added before final `doc.save()`

### reportExportService.ts
- `exportDoorSchedule()`: `const orderedDoors = [...doors]` guard before switch statement
- `exportHardwareSet()`: `const orderedDoors = [...doors]` + `const orderedHardwareSets = [...hardwareSets]` guards

## Commit
- `764140c`: (included in combined Wave 2 commit — hardware set changes merged with excel-exports commit)
