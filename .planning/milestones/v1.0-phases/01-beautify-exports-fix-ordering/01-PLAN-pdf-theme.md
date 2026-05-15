# Plan: Create Shared PDF Theme Module

**Phase:** 1 — Beautify Exports & Fix Ordering
**Goal:** Create `services/pdfTheme.ts` — the single source of truth for all PDF visual constants, branded header/footer drawing, and autotable option construction.
**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07
**Dependencies:** None — this is the foundation all other PDF plans build on.

---

## Context

**Files to read before starting:**
- `services/pdfExportService.ts` — see current hardcoded colors: `[147, 51, 234]` (purple, Hardware Set), `[59, 130, 246]` (blue, Door Schedule PDF via service), `[66, 139, 202]` (submittal blue). All of these will be replaced by constants from pdfTheme.ts.
- `components/doorSchedule/DoorScheduleConfig.tsx` lines 618–640 — see current `autoTable()` call with hardcoded `fillColor: [30, 41, 59]` and `margin: { left: MARGIN, right: MARGIN }`. This is the reference pattern; pdfTheme will standardize it.
- `tailwind.config.ts` — confirm brand navy is Tailwind slate-900 (`#1E293B` = RGB `[30, 41, 59]`).

**Key constraints:**
- Library: jsPDF 4.0.0 + jsPDF-autotable 5.0.7 (already installed, browser-side only).
- Logo must be a base64 PNG constant — NOT a runtime `fetch()` call. SVG rendering in jsPDF is inconsistent across browsers.
- Page numbers require a two-pass approach. During `didDrawPage`, draw all header content and body decoration but write page numbers in a separate loop AFTER `autoTable()` returns (because `getNumberOfPages()` is not final during rendering).
- The `margin.top: 18` in `buildAutoTableOptions()` reserves space for the branded header bar so the table never overlaps it.
- `rowPageBreak: 'avoid'` is set once inside `buildAutoTableOptions()` — individual callers must NOT override it.
- `repeatHeaders` defaults to `true` in jsPDF-autotable v5.x. Confirm no caller passes `repeatHeaders: false`.
- This file has NO React imports and NO browser globals at module scope — it must be importable server-side (Next.js SSR safety, even though execution is client-only).

---

## Tasks

### Task 1: Create the brand constants and logo stub

Create `services/pdfTheme.ts` with the following content. Do not skip any export — downstream plans depend on every named export in this file.

```typescript
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
```

### Task 2: Add `drawPageHeader` and `addPageNumbers` functions

Append the following two functions to `services/pdfTheme.ts` immediately after the constants block. These implement the two-pass page numbering pattern required to avoid the "Page 1 of 1" bug on all pages.

```typescript
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
```

### Task 3: Add `buildAutoTableOptions` — the shared autotable options factory

Append the following function to `services/pdfTheme.ts`. This is the primary integration point: every `autoTable()` call in the codebase will spread the return value of this function to pick up consistent styling.

```typescript
// ---------------------------------------------------------------------------
// buildAutoTableOptions — returns a partial AutoTable options object that
// callers spread into their autoTable() call.
//
// Usage:
//   autoTable(doc, {
//     ...buildAutoTableOptions(theme, reportTitle, exportDate, pageW, projectName),
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
```

---

## Verification

- [ ] `services/pdfTheme.ts` exists and TypeScript compiles without errors: run `npx tsc --noEmit` from project root — zero new errors.
- [ ] All five exports are resolvable: `BRAND_NAVY`, `DEFAULT_THEME`, `drawPageHeader`, `addPageNumbers`, `buildAutoTableOptions`.
- [ ] `LOGO_BASE64_PNG` is a non-empty string (placeholder PNG is fine for now; real logo injected in Plan 3 or 4 execution).
- [ ] No React import or browser global (`window`, `document`, `navigator`) at module scope — the file must be importable in a Node.js test environment.
- [ ] `HEADER_BAR_HEIGHT` is `18` — this value is referenced by Plans 3 and 4 when computing `startY`.
