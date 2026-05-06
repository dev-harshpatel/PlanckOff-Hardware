/**
 * pdfTheme.ts
 * Single source of truth for PlanckOff PDF visual identity.
 * Imported by: DoorScheduleConfig.tsx, pdfExportService.ts
 *
 * IMPORTANT: Keep this file free of React imports and browser globals at module scope.
 * All jsPDF usage is inside function bodies (called only in browser context).
 */

// ---------------------------------------------------------------------------
// Brand color constants — RGB tuples for jsPDF / jsPDF-autotable
// ---------------------------------------------------------------------------
/** Primary header fill — Tailwind slate-900, #1E293B */
export const BRAND_NAVY: [number, number, number] = [30, 41, 59];

/** Header text on dark fill — white */
export const BRAND_TEXT_ON_DARK: [number, number, number] = [255, 255, 255];

/** Alternating row fill — Tailwind slate-50, #F8FAFC */
export const ROW_ALT_FILL: [number, number, number] = [248, 250, 252];

/** Separator line color */
export const SEPARATOR_COLOR: [number, number, number] = [200, 200, 200];

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
/** Default page margin in mm — matches existing code in DoorScheduleConfig */
export const PDF_MARGIN = 14;

/** Height reserved at the top of every page for the branded header bar, in mm */
export const HEADER_BAR_HEIGHT = 18;

/** Distance from page bottom for footer text, in mm */
export const FOOTER_OFFSET = 5;

// ---------------------------------------------------------------------------
// Logo — embed as a tiny base64 PNG so no async fetch is required at export time.
// To update: open public/images/logo.svg in a browser, screenshot at 40x40px,
// save as PNG, run `btoa(binaryString)` and paste the result here.
//
// Placeholder: a 1x1 transparent PNG — replace with real logo before shipping.
// ---------------------------------------------------------------------------
export const LOGO_BASE64_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ---------------------------------------------------------------------------
// Theme interface
// ---------------------------------------------------------------------------
export interface PdfTheme {
  headFill:    [number, number, number];
  headText:    [number, number, number];
  altRowFill:  [number, number, number];
  margin:      number;
  fontSize:    number;
  cellPadding: number;
}

export const DEFAULT_THEME: PdfTheme = {
  headFill:    BRAND_NAVY,
  headText:    BRAND_TEXT_ON_DARK,
  altRowFill:  ROW_ALT_FILL,
  margin:      PDF_MARGIN,
  fontSize:    8,
  cellPadding: 2,
};

// ---------------------------------------------------------------------------
// drawPageHeader — called inside autoTable's didDrawPage callback.
// Draws the branded bar at the top of the current page.
// Does NOT write page numbers (those require a second pass after autoTable).
// ---------------------------------------------------------------------------
/**
 * @param doc        jsPDF instance (typed as `any` because jsPDF type differs across versions)
 * @param reportTitle Short label centered in the header, e.g. "Door Schedule"
 * @param exportDate  Formatted date string, right-aligned, e.g. "2026-05-07"
 * @param pageWidth   doc.internal.pageSize.getWidth()
 * @param margin      Horizontal margin in mm (use PDF_MARGIN)
 */
export function drawPageHeader(
  doc: any,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  margin: number,
): void {
  // Logo (top-left)
  try {
    doc.addImage(LOGO_BASE64_PNG, 'PNG', margin, 3, 8, 8);
  } catch {
    // Logo render failure must never break the export
  }

  // "PlanckOff" brand name next to logo
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('PlanckOff', margin + 10, 8.5);

  // Report title — centered
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(reportTitle, pageWidth / 2, 8.5, { align: 'center' });

  // Export date — right-aligned
  doc.text(exportDate, pageWidth - margin, 8.5, { align: 'right' });

  // Separator line below header bar
  doc.setDrawColor(...SEPARATOR_COLOR);
  doc.setLineWidth(0.3);
  doc.line(margin, 13, pageWidth - margin, 13);

  // Reset text color so table content is unaffected
  doc.setTextColor(0, 0, 0);
}

// ---------------------------------------------------------------------------
// addPageNumbers — call this AFTER autoTable() returns, not inside didDrawPage.
// At that point doc.internal.getNumberOfPages() is the true final total.
// The projectName is shown left-aligned in the footer as context.
// ---------------------------------------------------------------------------
/**
 * @param doc          jsPDF instance
 * @param projectName  Shown in footer left side
 * @param pageWidth    doc.internal.pageSize.getWidth()
 * @param pageHeight   doc.internal.pageSize.getHeight()
 * @param margin       Horizontal margin in mm
 * @param startPage    First page to number (default 1; pass higher if cover page precedes)
 */
export function addPageNumbers(
  doc: any,
  projectName: string,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  startPage = 1,
): void {
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = startPage; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);

    // Project name — left
    doc.text(projectName, margin, pageHeight - FOOTER_OFFSET);

    // "Page X of Y" — center
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - FOOTER_OFFSET,
      { align: 'center' },
    );

    doc.setTextColor(0, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// buildAutoTableOptions — returns a partial AutoTable options object that
// callers spread into their autoTable() call.
//
// Usage:
//   autoTable(doc, {
//     ...buildAutoTableOptions(theme, reportTitle, exportDate, pageW, margin),
//     head: [headers],
//     body: rows,
//     startY: 20,
//     columnStyles: { ... },   // caller-specific overrides are fine
//   });
//   addPageNumbers(doc, projectName, pageW, pageH, margin);
// ---------------------------------------------------------------------------
export function buildAutoTableOptions(
  theme: PdfTheme,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  margin: number,
): Record<string, unknown> {
  return {
    // Table body styles
    styles: {
      fontSize:    theme.fontSize,
      cellPadding: theme.cellPadding,
      overflow:    'linebreak',
    },

    // Column header row styles
    headStyles: {
      fillColor: theme.headFill,
      textColor: theme.headText,
      fontStyle: 'bold',
      halign:    'center',
    },

    // Alternating row shading
    alternateRowStyles: {
      fillColor: theme.altRowFill,
    },

    // Horizontal margin + top margin reserves space for branded header bar
    margin: {
      left:  margin,
      right: margin,
      top:   HEADER_BAR_HEIGHT,
    },

    // Prevent any row from being split mid-record at a page boundary (PDF-07)
    rowPageBreak: 'avoid',

    // repeatHeaders defaults to true in autotable v5.x (PDF-06) — explicit for clarity
    repeatHeaders: true,

    // Per-page branded header — fires on every page including page 2+
    // NOTE: page numbers are NOT written here; call addPageNumbers() after autoTable().
    didDrawPage: (data: any) => {
      drawPageHeader(data.doc, reportTitle, exportDate, pageWidth, margin);
    },
  };
}
