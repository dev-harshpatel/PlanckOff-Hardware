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

// ---------------------------------------------------------------------------
// Metadata header helpers
// Adds 2 branded rows above the column headers so every Excel export has
// a clear "cover" section identifying the report, project, and export date.
//
// Layout (rows 0–2):
//   Row 0 │ PlanckOff — Hardware Set Report          │ navy fill, white bold
//   Row 1 │ Project: Hood Slide  │ Exported: 5/7/26  │ light fill, muted text
//   Row 2 │ (empty separator)                         │ unstyled
//   Row 3 │ Column Header 1  │ Column Header 2  │ …   │ styled by applyHeaderRowAt
//   Row 4+ │ data rows
//
// Usage:
//   const metaRows = buildMetadataRows({ reportTitle, projectName, itemCount });
//   const wsData   = [...metaRows, headers, ...dataRows];
//   const ws       = XLSX.utils.aoa_to_sheet(wsData);
//   applyMetadataStyles(ws, headers.length);
//   applyHeaderRowAt(ws, 3, headers.length);       // style column-header row
//   applyFreezeAt(ws, 4);                          // freeze meta + col-header
//   ws['!cols'] = contentAwareColWidths(headers, dataRows);
// ---------------------------------------------------------------------------

export const XLS_META_FILL   = 'EFF6FF'; // blue-50 — light info band
export const XLS_META_TEXT   = '1E293B'; // slate-900 — readable on light bg
export const XLS_ACCENT_FILL = '1E3A5F'; // slightly lighter navy for title row

export interface ExcelMetadata {
  reportTitle: string;   // e.g. "Hardware Set Report"
  projectName: string;   // e.g. "Hood Slide Comp"
  exportDate?: string;   // defaults to today's locale date
  itemCount?: number;    // e.g. 6 — shown as "6 items"
  extraInfo?: string;    // optional extra detail (e.g. grouping mode)
}

/** Returns the 3 pre-data rows to prepend to your wsData array. */
export function buildMetadataRows(meta: ExcelMetadata): unknown[][] {
  const date = meta.exportDate ?? new Date().toLocaleDateString();
  const parts: string[] = [`Project: ${meta.projectName}`, `Exported: ${date}`];
  if (meta.itemCount !== undefined) parts.push(`${meta.itemCount} item${meta.itemCount !== 1 ? 's' : ''}`);
  if (meta.extraInfo) parts.push(meta.extraInfo);

  return [
    [`PlanckOff  —  ${meta.reportTitle}`], // row 0: title
    [parts.join('     ')],                  // row 1: info band
    [],                                      // row 2: empty separator
  ];
}

/** Styles rows 0 and 1 of the worksheet as a branded metadata header.
 *  Call AFTER XLSX.utils.aoa_to_sheet() with the metadata rows prepended.
 *  @param ws        The worksheet
 *  @param colCount  Number of columns (for cell merges)
 */
export function applyMetadataStyles(ws: XLSX.WorkSheet, colCount: number): void {
  // Merge both rows across all columns for a clean full-width look
  ws['!merges'] = (ws['!merges'] ?? []).concat([
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, colCount - 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, colCount - 1) } },
  ]);

  // Row 0 — title: dark navy, white bold
  const a0 = XLSX.utils.encode_cell({ r: 0, c: 0 });
  if (ws[a0]) {
    ws[a0].s = {
      font:      { bold: true, sz: 12, color: { rgb: XLS_HEADER_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: XLS_ACCENT_FILL } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  // Row 1 — info band: light blue-50 bg, slate text
  const a1 = XLSX.utils.encode_cell({ r: 1, c: 0 });
  if (ws[a1]) {
    ws[a1].s = {
      font:      { sz: 9, color: { rgb: XLS_META_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: XLS_META_FILL } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  // Row heights: title taller, info band normal
  (ws as any)['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 6 }];
}

/** Styles a specific row index as a column header (navy + white bold). */
export function applyHeaderRowAt(ws: XLSX.WorkSheet, rowIdx: number, colCount: number): void {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font:      { bold: true, color: { rgb: XLS_HEADER_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: XLS_HEADER_FILL } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
  }
}

/** Freezes rows 0..rowIdx-1 so the metadata + column headers stay visible. */
export function applyFreezeAt(ws: XLSX.WorkSheet, rowIdx: number): void {
  (ws as any)['!freeze'] = {
    xSplit:      0,
    ySplit:      rowIdx,
    topLeftCell: XLSX.utils.encode_cell({ r: rowIdx, c: 0 }),
    activePane:  'bottomLeft',
    state:       'frozen',
  };
}
