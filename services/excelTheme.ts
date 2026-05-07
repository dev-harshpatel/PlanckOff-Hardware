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

import * as XLSX from 'xlsx-js-style';

// ---------------------------------------------------------------------------
// Brand color constants — hex strings for xlsx cell fill (no leading '#')
// ---------------------------------------------------------------------------
/** Header fill — same navy as PDF theme (#1E293B) */
export const XLS_HEADER_FILL = '1E293B';

/** Header text color — white */
export const XLS_HEADER_TEXT = 'FFFFFF';

// ---------------------------------------------------------------------------
// XLSX_WRITE_OPTIONS
// Spread this into every XLSX.write() call to ensure cell styles are preserved.
//
// Example:
//   const bytes = XLSX.write(wb, { ...XLSX_WRITE_OPTIONS });
//   saveAs(new Blob([bytes], { type: 'application/octet-stream' }), 'file.xlsx');
// ---------------------------------------------------------------------------
export const XLSX_WRITE_OPTIONS = {
  bookType: 'xlsx' as const,
  type: 'array' as const,
  cellStyles: true,
};

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
// Note: '!freeze' is an undocumented but widely used SheetJS property.
// The cast to `any` is intentional — the property is not in the type definitions
// but is fully supported by SheetJS 0.18.5 at runtime.
//
// @param ws  The worksheet to freeze (mutated in place)
// ---------------------------------------------------------------------------
export function freezeHeaderRow(ws: XLSX.WorkSheet): void {
  (ws as any)['!freeze'] = {
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
