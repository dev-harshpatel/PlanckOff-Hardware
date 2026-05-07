/**
 * pdfTheme.ts
 * Single source of truth for PlanckOff PDF visual identity.
 * Imported by: DoorScheduleConfig.tsx, pdfExportService.ts, HardwareSetConfig.tsx
 *
 * IMPORTANT: Keep this file free of React imports and browser globals at module scope.
 * All jsPDF / browser API usage is inside function bodies (called only in browser context).
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

/** Separator / border color — Tailwind slate-200, #E2E8F0 */
export const SEPARATOR_COLOR: [number, number, number] = [226, 232, 240];

/** Muted text — Tailwind slate-400 */
export const TEXT_MUTED: [number, number, number] = [148, 163, 184];

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
/** Default page margin in mm */
export const PDF_MARGIN = 14;

/**
 * Height reserved at the top of every page for the branded header bar, in mm.
 * Table margin.top is set to this value so the table never overlaps the header.
 * startY for the first page should be HEADER_BAR_HEIGHT + 2.
 */
export const HEADER_BAR_HEIGHT = 24;

/** Distance from page bottom edge for footer baseline, in mm */
export const FOOTER_OFFSET = 6;

// ---------------------------------------------------------------------------
// Logo — 1×1 transparent PNG fallback used before the real asset loads.
// ---------------------------------------------------------------------------
export const LOGO_BASE64_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ---------------------------------------------------------------------------
// loadLogoDataUrl
// Fetches public/images/logo.png and converts it to a base64 data URL so
// jsPDF's addImage() can use it.  Call ONCE at the start of each export
// function (browser-only context).  Falls back silently if loading fails.
//
// Usage:
//   const logoDataUrl = await loadLogoDataUrl();
//   buildAutoTableOptions(..., { projectName, logoDataUrl })
// ---------------------------------------------------------------------------
export async function loadLogoDataUrl(logoPath = '/images/logo.png'): Promise<string> {
  try {
    const response = await fetch(logoPath);
    if (!response.ok) return LOGO_BASE64_PNG;
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => resolve(LOGO_BASE64_PNG);
      reader.readAsDataURL(blob);
    });
  } catch {
    return LOGO_BASE64_PNG;
  }
}

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
  cellPadding: 2.2,
};

// ---------------------------------------------------------------------------
// drawPageHeader
// Draws the branded header at the top of the current jsPDF page.
// Called inside autoTable's didDrawPage — fires on every page including 2+.
// Do NOT write page numbers here; use addPageNumbers() after autoTable().
//
// Visual layout (landscape A4, 297mm wide):
//
//   ┌──────────────────────────────────────────────────────────────────┐
//   █ navy accent bar (2.5mm)                                          █  ← y 0–2.5
//   ├──────────────────────────────────────────────────────────────────┤
//   │ [Logo]   │   Project Name (bold)             │  Exported: date   │  ← y ≈9
//   │          │   Report Type (muted)              │                   │  ← y ≈15
//   ├──────────────────────────────────────────────────────────────────┤  ← y ≈21
//   │                    table content                                  │
// ---------------------------------------------------------------------------
export function drawPageHeader(
  doc: any,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  margin: number,
  projectName?: string,
  logoDataUrl?: string,
): void {
  // ── Navy accent stripe at the very top ───────────────────────────────────
  doc.setFillColor(...BRAND_NAVY);
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  // ── Logo (logo only — no brand text next to it) ──────────────────────────
  const logoSrc = logoDataUrl || LOGO_BASE64_PNG;
  try {
    // 17×17mm, starting just below the accent bar
    doc.addImage(logoSrc, 'PNG', margin, 3.5, 17, 17);
  } catch {
    // Logo failure must never abort the export
  }

  // ── Project name — bold, prominent, center ────────────────────────────────
  if (projectName) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_NAVY);
    doc.text(projectName, pageWidth / 2, 9.5, { align: 'center' });
  }

  // ── Report type — smaller, muted, center ─────────────────────────────────
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(reportTitle, pageWidth / 2, 16, { align: 'center' });

  // ── Export date — top-right, muted ───────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Exported: ${exportDate}`, pageWidth - margin, 9.5, { align: 'right' });

  // ── Separator line ────────────────────────────────────────────────────────
  doc.setDrawColor(...SEPARATOR_COLOR);
  doc.setLineWidth(0.5);
  doc.line(margin, 21, pageWidth - margin, 21);

  // Reset state for table rendering
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
}

// ---------------------------------------------------------------------------
// addPageNumbers
// Call AFTER autoTable() returns — at that point getNumberOfPages() is final.
// Draws a separator line + footer text on every page.
//
// @param doc          jsPDF instance
// @param projectName  Shown left-aligned in footer
// @param pageWidth    doc.internal.pageSize.getWidth()
// @param pageHeight   doc.internal.pageSize.getHeight()
// @param margin       Horizontal margin in mm
// @param startPage    First page to number (default 1)
// ---------------------------------------------------------------------------
export function addPageNumbers(
  doc: any,
  projectName: string,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  startPage = 1,
): void {
  const totalPages = doc.internal.getNumberOfPages();
  const footerY    = pageHeight - FOOTER_OFFSET;

  for (let p = startPage; p <= totalPages; p++) {
    doc.setPage(p);

    // Thin separator line above footer
    doc.setDrawColor(...SEPARATOR_COLOR);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    // Footer text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);

    // Project name — left
    doc.text(projectName, margin, footerY);

    // "Page X of Y" — center
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth / 2,
      footerY,
      { align: 'center' },
    );

    // PlanckOff brand — right
    doc.text('PlanckOff', pageWidth - margin, footerY, { align: 'right' });

    // Reset
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(0, 0, 0);
  }
}

// ---------------------------------------------------------------------------
// buildAutoTableOptions
// Returns a partial AutoTable options object ready to spread into autoTable().
//
// Usage:
//   autoTable(doc, {
//     ...buildAutoTableOptions(DEFAULT_THEME, 'Door Schedule', exportDate, pageW, margin, { projectName, logoDataUrl }),
//     head: [headers],
//     body: rows,
//     startY: HEADER_BAR_HEIGHT + 2,
//   });
//   addPageNumbers(doc, projectName, pageW, pageH, margin);
// ---------------------------------------------------------------------------
export function buildAutoTableOptions(
  theme: PdfTheme,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  margin: number,
  headerMeta?: { projectName?: string; logoDataUrl?: string },
): Record<string, unknown> {
  return {
    // Body cell styles
    styles: {
      fontSize:    theme.fontSize,
      cellPadding: theme.cellPadding,
      overflow:    'linebreak',
      lineColor:   SEPARATOR_COLOR,
      lineWidth:   0.1,
    },

    // Column header row
    headStyles: {
      fillColor:  theme.headFill,
      textColor:  theme.headText,
      fontStyle:  'bold',
      halign:     'center',
      fontSize:   theme.fontSize + 0.5,
      cellPadding: theme.cellPadding + 0.5,
    },

    // Alternating row shading
    alternateRowStyles: {
      fillColor: theme.altRowFill,
    },

    // Subtle outer table border
    tableLineColor: SEPARATOR_COLOR,
    tableLineWidth: 0.3,

    // Page margins — top reserves space for the branded header bar
    margin: {
      left:   margin,
      right:  margin,
      top:    HEADER_BAR_HEIGHT,
      bottom: FOOTER_OFFSET + 5,
    },

    // No row split mid-record at page boundaries (PDF-07)
    rowPageBreak: 'avoid',

    // Column headers repeat on every page (PDF-06)
    repeatHeaders: true,

    // Per-page header — fires on page 1 and every subsequent page
    didDrawPage: (data: any) => {
      drawPageHeader(
        data.doc,
        reportTitle,
        exportDate,
        pageWidth,
        margin,
        headerMeta?.projectName,
        headerMeta?.logoDataUrl,
      );
    },
  };
}
