# Plan: Create Shared Excel Theme Module

**Phase:** 1 — Beautify Exports & Fix Ordering
**Goal:** Create `services/excelTheme.ts` — helper functions for bold/colored header styling, frozen top row, and content-aware column widths — usable across all three Excel export paths.
**Requirements:** XLS-01, XLS-02, XLS-03
**Dependencies:** None — this module has no runtime dependency on pdfTheme.ts and can be built in parallel with Plan 1.

---

## Context

**Files to read before starting:**
- `services/excelExportService.ts` lines 1–6 — confirm `import * as XLSX from 'xlsx'` is the pattern; excelTheme.ts uses the same import.
- `components/doorSchedule/DoorScheduleConfig.tsx` lines 386–395 — see the current bold-only header loop: `cell.s = { font: { bold: true } }` with no fill. This is the bug this plan fixes.
- `components/doorSchedule/DoorScheduleConfig.tsx` line 425 — see the current `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` call that is **missing `cellStyles: true`**. Note this exact line — Plan 5 will fix it, but understanding the bug starts here.
- `services/pricingReportService.ts` lines 1–2 — confirm `import * as XLSX from 'xlsx'` and `import { saveAs } from 'file-saver'`. Same import pattern used in excelTheme.ts.

**Key constraints:**
- Stay on `xlsx` (SheetJS 0.18.5) — do NOT use ExcelJS. The DoorScheduleConfig comment at line 360 is authoritative: ExcelJS has Next.js browser bundling issues.
- `cell.s` styling is silently dropped unless the workbook is written with `cellStyles: true`. This file documents the correct write pattern but does NOT call `XLSX.write()` itself — callers must include `cellStyles: true`.
- Freeze pane syntax: `ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }`. This freezes after row 1 (the header row).
- Content-aware widths cap at 50 characters to prevent excessively wide columns on notes/description fields.
- This file has zero React imports and zero browser globals at module scope.

---

## Tasks

### Task 1: Create `services/excelTheme.ts` with header style constants

Create `services/excelTheme.ts` with the following content:

```typescript
/**
 * excelTheme.ts
 * Shared helpers for Excel (xlsx/SheetJS) export styling.
 * Imported by: DoorScheduleConfig.tsx, excelExportService.ts, pricingReportService.ts
 *
 * REQUIREMENT: Every XLSX.write() call in a file that uses these helpers MUST include
 *   cellStyles: true
 * in its write options. Without it, the `cell.s` properties set here are silently ignored.
 *
 * Correct write pattern:
 *   const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
 */

import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Brand color constants — hex strings for xlsx cell fill (no leading '#')
// ---------------------------------------------------------------------------
/** Header fill — same navy as PDF theme (#1E293B) */
export const XLS_HEADER_FILL = '1E293B';

/** Header text color — white */
export const XLS_HEADER_TEXT = 'FFFFFF';

// ---------------------------------------------------------------------------
// applyHeaderRow
// Applies bold text + brand navy background to every cell in row 0 of the
// given worksheet. Call this AFTER XLSX.utils.aoa_to_sheet() or sheet_from_json()
// and BEFORE XLSX.utils.book_append_sheet().
//
// @param ws  The worksheet to style (mutated in place)
// ---------------------------------------------------------------------------
export function applyHeaderRow(ws: XLSX.WorkSheet): void {
  const ref = ws['!ref'];
  if (!ref) return;

  const range = XLSX.utils.decode_range(ref);

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;

    ws[addr].s = {
      font: {
        bold:  true,
        color: { rgb: XLS_HEADER_TEXT },
      },
      fill: {
        patternType: 'solid',
        fgColor:     { rgb: XLS_HEADER_FILL },
      },
      alignment: {
        horizontal: 'center',
        vertical:   'center',
        wrapText:   true,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// freezeHeaderRow
// Freezes the top row so it stays visible when scrolling large sheets.
// Call after all cells are written, before book_append_sheet.
//
// @param ws  The worksheet to freeze (mutated in place)
// ---------------------------------------------------------------------------
export function freezeHeaderRow(ws: XLSX.WorkSheet): void {
  ws['!freeze'] = {
    xSplit:      0,
    ySplit:      1,          // freeze after row 1 (the header)
    topLeftCell: 'A2',
    activePane:  'bottomLeft',
    state:       'frozen',
  };
}

// ---------------------------------------------------------------------------
// contentAwareColWidths
// Returns an array of { wch } column width objects suitable for ws['!cols'].
// Width is the max of: header length + 2, data column max length + 2, minimum 10.
// Data length is capped at 50 to prevent runaway widths on notes fields.
//
// @param headers   Array of header strings (row 0 of the sheet)
// @param dataRows  Array of data rows (each row is an array of cell values)
// @returns         XLSX.ColInfo[] ready to assign to ws['!cols']
// ---------------------------------------------------------------------------
export function contentAwareColWidths(
  headers: string[],
  dataRows: unknown[][],
): XLSX.ColInfo[] {
  return headers.map((header, colIdx) => {
    const dataMax = dataRows.reduce((max, row) => {
      const cellValue = String((row as unknown[])[colIdx] ?? '');
      return Math.max(max, cellValue.length);
    }, 0);

    const width = Math.max(
      header.length + 2,          // header text + padding
      Math.min(dataMax + 2, 50),  // data + padding, capped at 50
      10,                          // minimum readable width
    );

    return { wch: width };
  });
}

// ---------------------------------------------------------------------------
// applySheetTheme
// Convenience function that applies all three theme operations in the correct order.
// Equivalent to calling applyHeaderRow → freezeHeaderRow → set ws['!cols'].
//
// Use this when you have headers and all data rows available at once.
//
// @param ws        The worksheet (mutated in place)
// @param headers   Header strings for width calculation
// @param dataRows  Data rows for width calculation
// ---------------------------------------------------------------------------
export function applySheetTheme(
  ws: XLSX.WorkSheet,
  headers: string[],
  dataRows: unknown[][],
): void {
  applyHeaderRow(ws);
  freezeHeaderRow(ws);
  ws['!cols'] = contentAwareColWidths(headers, dataRows);
}
```

### Task 2: TypeScript compile check

After writing the file, verify it compiles without errors. Run from the project root:

```
npx tsc --noEmit
```

Fix any TypeScript errors before marking this plan done. Common issues to watch for:
- `XLSX.ColInfo` type not found — if so, use `{ wch: number }[]` as the return type.
- `XLSX.WorkSheet` freeze property not in type definitions — if so, cast: `(ws as any)['!freeze'] = ...`.

### Task 3: Verify the freeze pane property name

Confirm `!freeze` is the correct SheetJS 0.18.5 freeze pane key by checking one of:
- The installed package: `node_modules/xlsx/types/index.d.ts` — search for `freeze`.
- If the type definition names it differently (e.g., `Freeze`), update the property accordingly in `excelTheme.ts`.

If `!freeze` is not in the SheetJS 0.18.5 type definitions (it may be an undocumented property), cast the worksheet as `any` for that assignment only:
```typescript
(ws as any)['!freeze'] = { ... };
```

---

## Verification

- [ ] `services/excelTheme.ts` exists.
- [ ] `npx tsc --noEmit` produces zero new errors (compare against baseline before this plan).
- [ ] All four exports are present: `applyHeaderRow`, `freezeHeaderRow`, `contentAwareColWidths`, `applySheetTheme`.
- [ ] `XLS_HEADER_FILL` is `'1E293B'` and `XLS_HEADER_TEXT` is `'FFFFFF'` — matching the PDF theme navy.
- [ ] No React import or browser global at module scope.
- [ ] The JSDoc comment at the top of the file prominently warns callers to include `cellStyles: true` in `XLSX.write()`.
