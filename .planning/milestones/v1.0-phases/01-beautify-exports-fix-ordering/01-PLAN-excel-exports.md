# Plan: Apply Excel Theme to All Excel Exports + Fix Ordering

**Phase:** 1 — Beautify Exports & Fix Ordering
**Goal:** Apply `excelTheme.ts` helpers (bold navy header, freeze pane, content-aware widths) to every Excel export path, fix the `cellStyles: true` bug that silently drops all styling, and add ORD-04 order-preservation guards at each Excel entry point.
**Requirements:** XLS-01, XLS-02, XLS-03, ORD-02, ORD-04
**Dependencies:** Plan 2 (excel-theme) must be complete — `services/excelTheme.ts` must exist before this plan runs.

---

## Context

**Files to read before starting:**
- `services/excelTheme.ts` — full file. Required exports: `applyHeaderRow`, `freezeHeaderRow`, `contentAwareColWidths`, `applySheetTheme`.
- `components/doorSchedule/DoorScheduleConfig.tsx` lines 358–535 — the full Excel branch of `handleDownload()`. The critical bug is at line 425: `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` — missing `cellStyles: true`. Also note lines 386–395: the existing `cell.s = { font: { bold: true } }` loop that currently has no effect because of the missing `cellStyles: true`.
- `services/excelExportService.ts` — read the full file. Functions to update: `exportDoorScheduleToExcel()`, `exportHardwareSetToExcel()`, `exportMultiSheetWorkbook()`. Also look at the internal helpers `createComprehensiveDoorScheduleSheet()`, `createComprehensiveHardwareScheduleSheet()`, `createFrameDetailsSheet()`, `createProcurementSummarySheet()`.
- `services/pricingReportService.ts` — read the full file. Functions to update: `addCoverSheet()`, `addDoorLineItemsSheet()`, `addHardwareLineItemsSheet()`, `addCostSummarySheet()`, and `addPriceBookSheet()`. The entry point is `exportPricingReportToExcel()`.
- `services/reportExportService.ts` — ORD-04 guards for the Excel path of `exportDoorSchedule()` are already added in Plan 4 (Hardware Set PDF plan). Verify they exist. If Plan 4 has not run yet, add them here.

**Key constraints:**
- The `cellStyles: true` fix must be applied to EVERY `XLSX.write()` or `XLSX.writeFile()` call in the three files above. Missing even one means styling is silently dropped for that export.
- `excelExportService.ts` may use `XLSX.writeFile()` instead of `XLSX.write()` — check. `XLSX.writeFile()` also accepts write options as the third argument: `XLSX.writeFile(wb, filename, { bookType: 'xlsx', cellStyles: true })`.
- The `applySheetTheme()` convenience function requires `headers` (string[]) and `dataRows` (the body rows as unknown[][]). In each sheet-creation function, these arrays must be in scope when `applySheetTheme` is called. If a sheet is built using `XLSX.utils.json_to_sheet()` instead of `aoa_to_sheet()`, the header row is in row 0 of the sheet but the data rows need to be extracted differently — see Task 3 below for the json_to_sheet case.
- The Door Schedule Excel path in `DoorScheduleConfig.tsx` uses a per-sheet loop with JSZip image injection. The `applySheetTheme` call must happen INSIDE the sheet loop, after `XLSX.utils.aoa_to_sheet([headers, ...rows])` and BEFORE `XLSX.utils.book_append_sheet(wb, ws, sheetName)`. The existing bold-only loop (lines 390–394) is replaced by `applySheetTheme`.
- The existing `ws['!cols']` assignments in each service (some have partial per-column widths) must be REMOVED and replaced by `contentAwareColWidths()`. Do not keep both — they would conflict.
- ORD-04 guard in pricingReportService: add `const orderedDoors = [...doors]` at the top of `exportPricingReportToExcel()` and replace `doors` in the `generatePricingReport()` call.

---

## Tasks

### Task 1: Fix `DoorScheduleConfig.tsx` Excel path

Open `components/doorSchedule/DoorScheduleConfig.tsx`. In `handleDownload()`, locate the Excel branch (the `if (format === 'excel')` block, starting around line 358).

**a) Add the excelTheme import.** This import must use the dynamic import pattern consistent with the rest of the component (all library imports here are dynamic via `Promise.all`). However, `excelTheme.ts` is a local module with no bundling issues — it can be a static import at the top of the file. Add to the top-level imports:

```typescript
import { applySheetTheme } from '../../services/excelTheme';
```

If path aliases are configured (e.g., `@/services/excelTheme`), use the alias instead.

**b) Replace the existing header-styling loop.** Find lines 390–394:
```typescript
// Bold header row
const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
}
```

Delete these 6 lines entirely. Replace them with a single call:
```typescript
// Apply brand header styling, freeze pane, and content-aware column widths (XLS-01/02/03)
applySheetTheme(ws, headers, rows);
```

Note: `headers` is already in scope (defined at line 338). `rows` is already in scope (defined just before in the sheet loop).

**c) Fix the `cellStyles: true` bug.** Find line 425:
```typescript
const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
```

Change it to:
```typescript
const xlsxBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }) as Uint8Array;
```

**d) Remove any existing `ws['!cols']` assignment** inside the sheet loop if one exists. `applySheetTheme` sets `ws['!cols']` via `contentAwareColWidths()`.

### Task 2: Apply theme to `excelExportService.ts`

Open `services/excelExportService.ts`. Add the import at the top:

```typescript
import { applySheetTheme, applyHeaderRow, freezeHeaderRow, contentAwareColWidths } from './excelTheme';
```

For each sheet-creation function (`createComprehensiveDoorScheduleSheet`, `createComprehensiveHardwareScheduleSheet`, `createFrameDetailsSheet`, `createProcurementSummarySheet`), locate the pattern where a worksheet is created and rows are added. Apply `applySheetTheme(ws, headers, dataRows)` after the sheet is populated and before it is appended to the workbook.

**General pattern to apply in each function:**

Before:
```typescript
const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
ws['!cols'] = [{ wch: 30 }, { wch: 40 }, ...]; // existing fixed widths
XLSX.utils.book_append_sheet(wb, ws, 'Sheet Name');
```

After:
```typescript
const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
applySheetTheme(ws, headerRow, dataRows);  // replaces all ws['!cols'] and adds header style + freeze
XLSX.utils.book_append_sheet(wb, ws, 'Sheet Name');
```

Remove ALL existing `ws['!cols']` assignments in these functions — `applySheetTheme` replaces them.

**Fix `cellStyles: true` in write calls.** Search the file for all `XLSX.writeFile(` and `XLSX.write(` calls. For each one:
- `XLSX.writeFile(wb, filename)` → `XLSX.writeFile(wb, filename, { cellStyles: true })`
- `XLSX.write(wb, opts)` → ensure `cellStyles: true` is in `opts`

**ProcurementSummarySheet special case:** This sheet explicitly sorts manufacturers alphabetically (`Array.from(manufacturerGroups.keys()).sort()`). This is intentional by-design sorting — do NOT change it. `applySheetTheme` must still be applied for visual consistency.

### Task 3: Apply theme to `pricingReportService.ts`

Open `services/pricingReportService.ts`. Add the import at the top:

```typescript
import { applySheetTheme } from './excelTheme';
```

The pricing service creates five sheets via helper functions: `addCoverSheet`, `addDoorLineItemsSheet`, `addHardwareLineItemsSheet`, `addCostSummarySheet`, `addPriceBookSheet` (conditional).

**For each `add*Sheet` function** that writes tabular data (Door Line Items, Hardware Line Items, Cost Summary, Price Book):
1. Identify where the header row array is defined (e.g., `const headers = ['Door Tag', 'Location', ...]`).
2. Identify where the data rows are assembled (e.g., `const rows = report.doorLineItems.map(...)`).
3. After `const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])`, add: `applySheetTheme(ws, headers, rows)`.
4. Remove any existing `ws['!cols']` assignment in the function.

**Cover sheet** (`addCoverSheet`): The cover sheet likely contains project metadata labels and values rather than a standard tabular header. Apply `applyHeaderRow(ws)` and `freezeHeaderRow(ws)` individually only if row 0 is a meaningful header row. If the cover sheet is free-form (no column headers), skip `applySheetTheme` for this sheet only — apply to the other four sheets.

**Fix `cellStyles: true`.** Search `pricingReportService.ts` for all `XLSX.writeFile(` and `XLSX.write(`. Add `cellStyles: true` to each:
- `XLSX.writeFile(wb, filename)` → `XLSX.writeFile(wb, filename, { cellStyles: true })`

**ORD-04 guard.** At the top of `exportPricingReportToExcel()`, after the function signature opens, add:
```typescript
// ORD-04: explicit spread preserves call-site array order (UI display order)
const orderedDoors = [...doors];
const orderedHardwareSets = [...hardwareSets];
```

Replace `doors` and `hardwareSets` in the `generatePricingReport(doors, hardwareSets, ...)` call with `orderedDoors` and `orderedHardwareSets`.

### Task 4: Verify no remaining `cellStyles: true` omissions

After all three files are updated, do a final search across the codebase for `XLSX.write(` and `XLSX.writeFile(` to confirm every occurrence includes `cellStyles: true`. Files to check:
- `components/doorSchedule/DoorScheduleConfig.tsx`
- `services/excelExportService.ts`
- `services/pricingReportService.ts`

Any occurrence without `cellStyles: true` must be fixed before this plan is marked complete.

---

## Verification

- [ ] `npx tsc --noEmit` produces zero new errors.
- [ ] **Door Schedule Excel** (from `/project/[id]/reports/door-schedule`): Open the downloaded `.xlsx`. Row 1 has dark navy background with white bold text. Scrolling down keeps row 1 frozen. Column widths fit the content (no truncation visible, no extremely wide columns).
- [ ] **Hardware Set Excel** (from `/project/[id]/reports/hardware-set`): Same verification — navy header, frozen row 1, sensible column widths.
- [ ] **Pricing Excel** (from `/project/[id]/reports/pricing`): Open the downloaded `.xlsx`. Each data sheet (Door Line Items, Hardware Line Items, Cost Summary, Price Book) has navy header row, frozen row 1, content-aware widths.
- [ ] In all Excel files: existing data content is unchanged — no rows missing, no data corruption.
- [ ] Search `DoorScheduleConfig.tsx`, `excelExportService.ts`, and `pricingReportService.ts` for `cellStyles` — every `XLSX.write(` and `XLSX.writeFile(` occurrence must have `cellStyles: true`.
- [ ] Search the three files for `ws\['!cols'\]` — no occurrences should remain (all replaced by `contentAwareColWidths` inside `applySheetTheme`).
- [ ] The JSZip OOXML image injection in `DoorScheduleConfig.tsx` (lines ~432–533) is unmodified and still functional — elevation images still appear in Excel exports when enabled.
