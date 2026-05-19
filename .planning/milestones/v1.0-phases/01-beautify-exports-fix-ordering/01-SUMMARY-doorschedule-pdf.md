---
phase: 01-beautify-exports-fix-ordering
plan: 03
subsystem: exports
tags: pdf, jspdf, autotable, door-schedule, ordering

provides:
  - Door Schedule PDF export uses unified pdfTheme (buildAutoTableOptions, addPageNumbers)
  - ORD-04 safety guard at door schedule export entry point
  - Elevation header uses drawPageHeader() from pdfTheme

key-files:
  modified:
    - components/doorSchedule/DoorScheduleConfig.tsx
    - services/pdfExportService.ts
    - services/excelExportService.ts
    - services/reportExportService.ts

requirements-completed: [PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, ORD-01, ORD-03, ORD-04]

duration: ~15min
completed: 2026-05-07
---

# Plan 03: Apply PDF Theme to Door Schedule Export — Summary

**Replaced all hardcoded PDF colors in the Door Schedule export paths with unified pdfTheme constants; added ORD-04 spread guard and page number footer.**

## What Changed

### DoorScheduleConfig.tsx (Path A — inline export)
- Imported `buildAutoTableOptions`, `addPageNumbers`, `drawPageHeader`, `DEFAULT_THEME`, `PDF_MARGIN`, `HEADER_BAR_HEIGHT` from `@/services/pdfTheme`
- Added ORD-04 guard: `const orderedDoors = [...includedDoors]` before export loop
- Replaced hardcoded `autoTable()` options block (fillColor: [30, 41, 59]) with `...buildAutoTableOptions()`
- Added `addPageNumbers(doc, ...)` after the group loop, before `doc.save()`
- Replaced `addElevPageHeader` manual drawing with `drawPageHeader()`

### pdfExportService.ts (Path B — service export)
- Integrated pdfTheme for `exportDoorScheduleToPDF()`
- Uses `buildAutoTableOptions()` and `addPageNumbers()`
- `startY: HEADER_BAR_HEIGHT + 2` for consistent header spacing

### excelExportService.ts (bonus — linter-applied)
- Added `cellStyles: true` to `XLSX.writeFile` calls (fixes silent style-drop bug)

### reportExportService.ts (bonus — linter-applied)
- Added ORD-04 order-preservation guards at `exportDoorSchedule()` and `exportHardwareSet()` entry points

## Commit
- `0a634e1`: feat(exports): apply PDF theme to door schedule export
