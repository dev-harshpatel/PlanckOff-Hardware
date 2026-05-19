---
phase: 01-beautify-exports-fix-ordering
plan: 05
subsystem: exports
tags: excel, xlsx, sheetjs, ordering, cellstyles

provides:
  - All Excel exports use excelTheme (applySheetTheme, XLSX_WRITE_OPTIONS)
  - cellStyles: true bug fixed across all XLSX.write/writeFile calls
  - ORD-04 spread guards in pricingReportService.ts

key-files:
  modified:
    - services/pricingReportService.ts
    - components/hardware/HardwareSetConfig.tsx

requirements-completed: [XLS-01, XLS-02, XLS-03, ORD-02, ORD-04]

duration: ~20min
completed: 2026-05-07
---

# Plan 05: Apply Excel Theme to All Excel Exports — Summary

**Applied excelTheme to pricingReportService.ts; fixed cellStyles: true bug in HardwareSetConfig.tsx and pricingReportService.ts; added ORD-04 guards in pricingReportService.ts.**

## What Changed

### pricingReportService.ts
- Added `import { applySheetTheme } from './excelTheme'`
- ORD-04 guards: `const orderedDoors = [...doors]` + `const orderedHardwareSets = [...hardwareSets]` at top of `exportPricingReportToExcel()`
- Fixed `XLSX.writeFile(wb, fileName)` → `XLSX.writeFile(wb, fileName, { cellStyles: true })`
- Removed hardcoded `!cols` array — replaced with `applySheetTheme()` which uses `contentAwareColWidths()`
- Calls `applySheetTheme(ws, headers, dataRows)` on each worksheet before appending to workbook

### HardwareSetConfig.tsx (Excel export in hardware set inline component)
- Fixed `XLSX.writeFile(wb, ...)` → added `{ cellStyles: true }` option

## Notes
- excelExportService.ts cellStyles fix was already applied by Plan 3's linter pass (0a634e1)
- DoorScheduleConfig.tsx Excel path cellStyles fix was confirmed included in the Plan 3 commit

## Commit
- `764140c`: feat(exports): apply Excel theme and fix cellStyles across all Excel exports
