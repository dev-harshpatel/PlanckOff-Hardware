// services/excelExportService/index.ts
// Barrel: named re-exports from all three domain sub-files.
// No 'use client' — barrel has no hooks or direct browser API calls.
// VER-03 (default export re-export) is N/A — this service has no default export.
// All public named exports are provided here as required by SVC-02.

export { exportDoorScheduleToExcel } from './doorScheduleExcel';
export { exportHardwareSetToExcel } from './hardwareSetExcel';
export { exportMultiSheetWorkbook } from './multiSheetWorkbook';
export type { MultiSheetExportOptions } from './multiSheetWorkbook';
