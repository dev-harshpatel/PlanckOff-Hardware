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
export const HEADER_BAR_HEIGHT = 22;

/** Distance from page bottom for footer text, in mm */
export const FOOTER_OFFSET = 5;

// ---------------------------------------------------------------------------
// Logo — 1×1 transparent PNG fallback used when the real logo hasn't loaded yet.
// The real logo is loaded at runtime via loadLogoDataUrl() below.
// ---------------------------------------------------------------------------
export const LOGO_BASE64_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// ---------------------------------------------------------------------------
// loadLogoDataUrl — converts public/images/logo.svg → base64 PNG via canvas.
// Call ONCE at the start of each export function (browser-only context).
// Falls back to the transparent placeholder if conversion fails.
//
// Usage:
//   const logoDataUrl = await loadLogoDataUrl();
//   // then pass logoDataUrl into buildAutoTableOptions / drawPageHeader
// ---------------------------------------------------------------------------
export async function loadLogoDataUrl(logoPath = '/images/logo.svg'): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = 80;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(LOGO_BASE64_PNG); return; }
        ctx.drawImage(img, 0, 0, 80, 80);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(LOGO_BASE64_PNG);
      }
    };
    img.onerror = () => resolve(LOGO_BASE64_PNG);
    img.crossOrigin = 'anonymous';
    img.src = logoPath;
  });
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
  cellPadding: 2,
};

// ---------------------------------------------------------------------------
// drawPageHeader — called inside autoTable's didDrawPage callback.
// Draws the branded bar at the top of the current page.
// Does NOT write page numbers (those require a second pass after autoTable).
// ---------------------------------------------------------------------------
/**
 * @param doc          jsPDF instance
 * @param reportTitle  Document type label, e.g. "Door Schedule"
 * @param exportDate   Formatted date string, e.g. "2026-05-07"
 * @param pageWidth    doc.internal.pageSize.getWidth()
 * @param margin       Horizontal margin in mm (use PDF_MARGIN)
 * @param projectName  Project name shown prominently in the center (optional)
 * @param logoDataUrl  Base64 PNG data URL from loadLogoDataUrl() (optional, falls back to placeholder)
 */
export function drawPageHeader(
  doc: any,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  margin: number,
  projectName?: string,
  logoDataUrl?: string,
): void {
  const logoSrc = logoDataUrl || LOGO_BASE64_PNG;

  // ── Logo (top-left, 14×14mm) ──────────────────────────────────────────────
  try {
    doc.addImage(logoSrc, 'PNG', margin, 2, 14, 14);
  } catch {
    // Logo render failure must never break the export
  }

  // ── Brand name next to logo ───────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59); // BRAND_NAVY
  doc.text('PlanckOff', margin + 16, 8);

  // ── Row 1 center: Project name (bold, prominent) ─────────────────────────
  if (projectName) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(projectName, pageWidth / 2, 7, { align: 'center' });
  }

  // ── Row 2 center: Report type (smaller, muted) ───────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(reportTitle, pageWidth / 2, 13, { align: 'center' });

  // ── Right column: Export date ─────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported: ${exportDate}`, pageWidth - margin, 7, { align: 'right' });

  // ── Separator line ────────────────────────────────────────────────────────
  doc.setDrawColor(...SEPARATOR_COLOR);
  doc.setLineWidth(0.4);
  doc.line(margin, 18, pageWidth - margin, 18);

  // Reset
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
  headerMeta?: { projectName?: string; logoDataUrl?: string },
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
