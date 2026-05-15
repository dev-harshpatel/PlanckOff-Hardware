# Phase 1: Beautify PDF & Excel Exports with Consistent Styling and Sequential Data Ordering — Research

**Researched:** 2026-05-07
**Domain:** Client-side PDF generation (jsPDF + jsPDF-autotable), Excel generation (XLSX / SheetJS), data ordering
**Confidence:** HIGH — all findings verified by reading actual source files

---

## Summary

PlanckOff uses two distinct PDF code paths and two distinct Excel code paths that evolved independently and now have inconsistent styling. The primary export surface is `DoorScheduleConfig.tsx`, a 900-line component that contains its own inline PDF/Excel generation logic — the most sophisticated and recently maintained path. A parallel set of functions in `pdfExportService.ts` and `excelExportService.ts` handle Hardware Set and Submittal Package exports but use different colors, styles, and lack page footers. A third service, `pricingReportService.ts`, handles pricing exports using the same legacy XLSX library.

The core challenge is that there are **three independent export code paths** (DoorScheduleConfig inline, pdfExportService/excelExportService, and pricingReportService) that all need to be brought to a single shared standard. None of them have a global page footer with page numbers. None of them include a branded logo. Column headers repeat on each page only for the DoorScheduleConfig PDF path (via jsPDF-autotable default behavior). Ordering risks exist because the Hardware Set and Submittal report pages use `transformFromFinalJson()` which returns data in API response order — no explicit sort guard.

**Primary recommendation:** Create a single `services/pdfTheme.ts` module defining the PlanckOff brand constants (colors, fonts, margins, header/footer drawing functions) and apply it to all three PDF code paths. For Excel, add freeze-pane, bold header styling, and content-appropriate column widths to every export path. Add an explicit `[...arr]` order-preservation guard at each service entry point.

---

## 1. Current Export Architecture

### 1.1 PDF Library

**Library:** `jspdf` version **4.0.0** with `jspdf-autotable` version **5.0.7**

Both are installed as browser-side dependencies. `next.config.ts` marks them as `serverExternalPackages` to prevent SSR bundling. All PDF generation runs in the browser.

**Key jsPDF-autotable capabilities already in use:**
- `head: [headers]` — column headers in table
- `alternateRowStyles: { fillColor: [...] }` — alternating row shading
- `headStyles: { fillColor, textColor, fontStyle, halign }` — header styling
- `styles: { fontSize, cellPadding, overflow }` — body cell styling
- `theme: 'striped'` or `theme: 'grid'` or `theme: 'plain'`
- `columnStyles: { N: { cellWidth } }` — per-column widths
- `margin: { left, right }` — table margins

**jsPDF-autotable capabilities NOT yet used (needed for this phase):**
- `repeatHeaders: true` — repeat column headers on each new page (it defaults to `true` in autotable 5.x, but must be verified per call)
- `didDrawPage` callback — fires on every page, allowing footer/page-number injection
- `rowPageBreak: 'avoid'` — prevents a row from being split across pages (addresses PDF-07)

### 1.2 Excel Library

**Two libraries are in use — this is a problem:**

| Library | Version | Where Used |
|---------|---------|------------|
| `xlsx` (SheetJS Community) | 0.18.5 | `excelExportService.ts`, `pricingReportService.ts`, `DoorScheduleConfig.tsx` |
| `exceljs` | 4.4.0 | **Not used anywhere in export code** — installed but unused |

CONCERNS.md already flags `xlsx 0.18.5` as unmaintained with known CVEs, and recommends migrating to `exceljs`. However, the project made a deliberate decision to stay with `xlsx` for the Door Schedule path due to ExcelJS bundling issues in Next.js browser context (the comment in `DoorScheduleConfig.tsx` line 360 reads: "ExcelJS has bundling issues in Next.js browser context; direct OOXML injection via JSZip is the most reliable cross-environment approach").

**Decision for this phase:** Use `xlsx` (SheetJS) for all Excel exports to maintain consistency with the working Door Schedule export path. Do NOT attempt to migrate to ExcelJS — that belongs to a separate debt-reduction phase. The CONCERNS.md note about migration is valid but out of scope here.

**xlsx features already used:**
- `XLSX.utils.book_new()` / `XLSX.utils.aoa_to_sheet()` / `XLSX.utils.book_append_sheet()`
- `ws['!cols']` — column widths
- `cell.s = { font: { bold: true } }` — cell styling (used partially in DoorScheduleConfig)
- `ws['!autofilter']` — auto-filter ranges
- `ws['!merges']` — merged cells

**xlsx features NOT yet used (needed for this phase):**
- `ws['!freeze']` — freeze pane (addresses XLS-03)
  - Syntax: `ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' }`
- Consistent bold + fill color on header row across ALL export paths (XLS-01): the DoorScheduleConfig path applies `cell.s = { font: { bold: true } }` but no background fill; other paths apply no styling at all
- Content-aware column widths (XLS-02): DoorScheduleConfig uses fixed 15ch widths; other services use varying hard-coded values

**Note:** Cell styling via `cell.s` only works in `xlsx` when the workbook is written with `cellStyles: true` option: `XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true })`. The current DoorScheduleConfig download path uses `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` without `cellStyles: true`, so the bold header styling is silently dropped. This is a bug to fix.

### 1.3 The Three Export Code Paths

#### Path A: DoorScheduleConfig (inline in component)
**File:** `components/doorSchedule/DoorScheduleConfig.tsx` (lines 335–723)
**Triggered by:** `handleDownload()` inside `DoorScheduleConfig` component
**Data source:** `includedDoors` (doors filtered for EXCLUDE flag), then grouped via `useDoorAggregation` hook
**Entry point routes:**
- `/project/[id]/reports/door-schedule` → `DoorScheduleReportPage` → `<DoorScheduleConfig doors={doors} />`
- `/project/[id]/reports` (legacy, via ReportsView) → `<DoorScheduleConfig doors={doors} />`

**Current PDF output:**
- Title: project name (bold, 11pt) + group subtitle (8pt)
- No logo, no branded header, no footer, no page numbers
- `headStyles: { fillColor: [30, 41, 59] }` (dark navy blue — inconsistent with other paths)
- `alternateRowStyles: { fillColor: [248, 250, 252] }` (near-white)
- Uses `autoTable` — headers repeat by default in v5.x

**Current Excel output:**
- Uses `xlsx` + JSZip for OOXML image injection
- Bold header row styling present but silently dropped (missing `cellStyles: true`)
- No freeze pane, no background color on header row
- Column widths: fixed 15ch for all

#### Path B: pdfExportService / excelExportService
**Files:**
- `services/pdfExportService.ts` — `exportDoorScheduleToPDF()`, `exportHardwareSetToPDF()`, `exportSubmittalPackageToPDF()`
- `services/excelExportService.ts` — `exportDoorScheduleToExcel()`, `exportHardwareSetToExcel()`, `exportMultiSheetWorkbook()`
**Triggered by:**
- `reportExportService.ts` → `exportDoorSchedule()`, `exportHardwareSet()`, `exportSubmittalPackage()`
- `ReportsView.tsx` → `handleHardwareSetExport()`
- `/project/[id]/reports/hardware-set` → `HardwareSetReportPage` → `handleExport()`
- `/project/[id]/reports/submittal-package` → via `SubmittalGenerator` (uses `react-to-print`, NOT pdfExportService)

**Current PDF output (pdfExportService):**
- Door Schedule PDF: `headStyles: { fillColor: [59, 130, 246] }` (blue — different from Path A)
- Hardware Set PDF: `headStyles: { fillColor: [147, 51, 234] }` (purple — inconsistent with both other paths)
- Submittal Package: `headStyles: { fillColor: [66, 139, 202] }` (third shade of blue)
- No branded header with logo
- No footer with page numbers
- `theme: 'striped'` on door/hardware tables, `theme: 'grid'` on submittal door table
- Submittal cover page hand-coded with manual `doc.rect()` borders — not shared

**Current Excel output (excelExportService):**
- Uses `xlsx` directly via `XLSX.writeFile()`
- Door Schedule: all columns 15ch wide, no header styling
- Hardware Set: has some column-specific widths (Item: 30ch, Description: 40ch), no header styling
- Multi-sheet workbook: has column-specific widths, has `!autofilter`, no header styling, no freeze

#### Path C: pricingReportService
**File:** `services/pricingReportService.ts`
**Triggered by:** `PricingView.tsx` (via `PriceBookManager` or direct export buttons — need to verify)
**Entry point route:** `/project/[id]/reports/pricing`
**Library:** Uses `xlsx` + `saveAs` from `file-saver`
**Current output:**
- Cover sheet, Door Line Items, Hardware Line Items, Cost Summary, Price Book sheets
- No header styling, no freeze pane
- Has some column-specific widths per sheet
- Exports only Excel (no PDF path from this service)

#### Path D: SubmittalGenerator (print-based PDF)
**File:** `components/submittals/SubmittalGenerator.tsx`
**Library:** Uses `react-to-print` — generates PDF from browser print dialog, not from jsPDF
**Current output:** React component rendered to paper via `useReactToPrint`
**Note:** This path cannot use jsPDF-autotable. Styling must be done via print CSS. This is a separate approach — out of scope for jsPDF theming unless we change the submittal PDF to use jsPDF (which would be a significant refactor and is NOT what the requirements ask for). The `exportSubmittalPackageToPDF` function in `pdfExportService.ts` IS a jsPDF-based alternative but it is currently NOT called — the submittal page uses `react-to-print` exclusively.

---

## 2. Data Flow & Ordering Analysis

### 2.1 Door Schedule Data Flow

```
Supabase DB
  └── GET /api/projects/[id]/door-schedule
        └── dsJson.data.scheduleJson   ← raw DB JSON, order = DB insert order
              └── transformDoors(scheduleJson, sets) → Door[]
                    └── useState<Door[]>(loadedDoors)   ← no explicit sort
                          └── DoorScheduleConfig receives: doors prop
                                └── includedDoors = doors.filter(non-excluded)   ← preserves array order
                                      └── useDoorAggregation → groups
                                            └── handleDownload() → rowsByGroup → export
```

**Ordering risk (Door Schedule):** The `doors` array order is determined by `transformDoors()` in `utils/hardwareTransformers.ts`. If the API returns rows in DB insertion order and `transformDoors` preserves that order, the door schedule export will match the UI display order — as long as the UI itself displays in the same order. The `useDoorAggregation` hook processes `includedDoors` in the order they arrive. No explicit `orderBy` guard exists at any export handoff point.

**The grouping path:** When user applies grouping in the UI, `groups` is computed by `useDoorAggregation`. The export `rowsByGroup` iterates `groupsToExport` in the same order as `groups`. Within each group, doors are processed in the order they appear in `group.doors`. This preserves relative order within groups.

### 2.2 Hardware Set Data Flow

```
Supabase DB
  └── GET /api/projects/[id]/hardware-merge   ← primary source (finalJson)
        └── mergeJson.data.finalJson  (MergedHardwareSet[])
              └── transformFromFinalJson(finalData)  → { hardwareSets, doors }
                    └── useState<HardwareSet[]>(sets)
                    └── useState<Door[]>(loadedDoors)
                          └── exportHardwareSet(doors, hardwareSets, config, projectName)
                                └── calculateHardwareUsage(doors, hardwareSets)
                                      → iterates hardwareSets.forEach then set.items.forEach
                                          → usageStats array
                                              └── export service receives usageStats (Map iteration order)
```

**Ordering risk (Hardware Set):** `calculateHardwareUsage()` in `reportExportService.ts` builds a `Map<string, HardwareItemUsage>` keyed by `${item.name}|${item.description}|...`. Items are aggregated across sets. The result order is `Map` insertion order, which is the order items are first encountered iterating `hardwareSets.forEach(set => set.items.forEach(item => ...))`. This preserves the hardware set order from the API response, which itself preserves finalJson order. However, there is NO explicit guard — if the API response order changes or is non-deterministic, the export order will silently differ from the UI.

**Ordering risk (pricingReportService):** `generatePricingReport()` in `pricingService.ts` generates `doorLineItems` by iterating the `doors` array. Order follows the `doors` prop order. No explicit sort guard.

### 2.3 Where Ordering Can Break

| Location | Risk | Severity |
|----------|------|----------|
| `transformDoors()` in `hardwareTransformers.ts` | If transformer reorders or groups, export differs from UI | MEDIUM |
| `calculateHardwareUsage()` uses a `Map` | Map iteration order = insertion order; if set iteration changes, so does export | LOW (JS Maps preserve insertion order) |
| `transformFromFinalJson()` | Returns data in API order; no documented sort guarantee | MEDIUM |
| `formatUsage()` in all export services | **Sorts doorTags alphabetically** (`.sort()`) in usage columns — this sorts the list of door tags referencing a hardware item, not the main data array | LOW (by design, for readability) |
| `ProcurementSummarySheet` in `excelExportService.ts` | Explicitly sorts manufacturers alphabetically: `Array.from(manufacturerGroups.keys()).sort()` | INTENTIONAL (by manufacturer name) |

**ORD-04 gap:** No export entry point has an explicit `[...doors]` passthrough or index-based guard. The requirement to add explicit order-preservation logic as a safety net is unimplemented.

---

## 3. UI Entry Points (Where Users Trigger Exports)

### 3.1 Door Schedule Export
- **Route:** `/project/[id]/reports/door-schedule`
- **Component:** `DoorScheduleReportPage` → `DoorScheduleConfig`
- **Trigger:** User clicks "Download" button inside `DoorScheduleConfig` sidebar
- **Formats available:** Excel (.xlsx), PDF (.pdf) — format selected via toggle in sidebar
- **Data arrives via:** Three parallel fetch calls (`/api/projects/[id]/door-schedule`, `/api/projects/[id]/hardware-pdf`, `/api/projects/[id]`)

**Also accessible via:**
- `/project/[id]/reports` → `ReportsView` → card "Door-Frame Reports" → `DoorScheduleConfig` (same component, same export path)

### 3.2 Hardware Set Export
- **Route:** `/project/[id]/reports/hardware-set`
- **Component:** `HardwareSetReportPage` → `HardwareSetConfig` → `onExport` callback
- **Trigger:** User configures options in `HardwareSetConfig`, clicks export button
- **Formats available:** Excel (.xlsx), PDF (.pdf), CSV (.csv) — selected in config
- **Data arrives via:** `/api/projects/[id]/hardware-merge` (primary) or fallback to individual endpoints

**Also accessible via:**
- `/project/[id]/reports` → `ReportsView` → card "Hardware Set Report" → `HardwareSetConfig` → `handleHardwareSetExport()` which calls `exportHardwareSet()` from `reportExportService`

### 3.3 Pricing Export
- **Route:** `/project/[id]/reports/pricing`
- **Component:** `PricingReportPage` → `PricingView` → `PriceBookManager`
- **Formats available:** Excel (.xlsx), CSV (.csv)
- **Service:** `pricingReportService.ts` → `exportPricingReportToExcel()` / `exportPricingSummaryToCSV()`

### 3.4 Submittal Package Export
- **Route:** `/project/[id]/reports/submittal-package`
- **Component:** `SubmittalPackagePage` → `SubmittalGenerator`
- **Export mechanism:** `react-to-print` (browser print dialog → PDF) — NOT jsPDF
- **Data arrives via:** `/api/projects/[id]/hardware-merge` (finalJson)
- **Note:** The `exportSubmittalPackageToPDF()` function in `pdfExportService.ts` exists but is NOT called by the current submittal UI. The submittal package is the only export that uses `react-to-print` and is styled via print CSS, not jsPDF. Phase 1 requirements (PDF-01 through PDF-07) do not appear to target this path — VER-01 requires verification across Door Schedule, Hardware Sets, and Pricing only.

### 3.5 Old ReportsView (Legacy Path)
- **Route:** `/project/[id]/reports` (the reports index page, route group)
- **File:** `app/project/[id]/reports/page.tsx` — this is the OUTER layout shell
- **File:** `views/ReportsView.tsx` — the legacy view that shows 3 report cards
- Both paths (new sub-routes and legacy ReportsView) use the same underlying components and services

---

## 4. Library Capabilities (Unused Features We Need)

### 4.1 jsPDF + jsPDF-autotable (v4.0.0 + v5.0.7)

**Branded header/footer via `didDrawPage` callback (PDF-02, PDF-03):**
```typescript
autoTable(doc, {
  // ...table options...
  didDrawPage: (data) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    const pageNum   = (doc as any).internal.getCurrentPageInfo().pageNumber;

    // Header: draw logo + project name + export date
    // (logo as base64 image added with doc.addImage)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('PlanckOff Hardware', MARGIN, 8);
    doc.setFont('helvetica', 'normal');
    doc.text(projectName, MARGIN + 40, 8);
    doc.text(exportDate, PAGE_W - MARGIN, 8, { align: 'right' });

    // Footer: page numbers
    doc.setFontSize(7);
    doc.text(`Page ${pageNum} of ${pageCount}`, PAGE_W / 2, PAGE_H - 5, { align: 'center' });
  }
});
```

**Row page-break protection (PDF-07):**
```typescript
autoTable(doc, {
  rowPageBreak: 'avoid',   // prevents a row from being cut mid-record
  // ...
});
```

**Repeating headers (PDF-06):**
In jsPDF-autotable v5.x, `repeatHeaders` defaults to `true`. This is already working for any table rendered via `autoTable()`. Confirm this is not overridden anywhere.

**Starting Y position after manual header (PDF-02):**
When a branded header is drawn manually before the table, `startY` must account for the header height to avoid overlap. Current code already uses `startY` parameters — these will need updating when header height changes.

### 4.2 xlsx (SheetJS) for Excel

**Freeze pane (XLS-03):**
```typescript
ws['!freeze'] = {
  xSplit: 0,
  ySplit: 1,        // freeze after row 1 (the header row)
  topLeftCell: 'A2',
  activePane: 'bottomLeft',
  state: 'frozen'
};
```

**Bold + colored header row (XLS-01):**
```typescript
// Must write with cellStyles: true
const xlsxBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });

// Apply to each header cell (row 0)
const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
for (let c = range.s.c; c <= range.e.c; c++) {
  const addr = XLSX.utils.encode_cell({ r: 0, c });
  if (!ws[addr]) continue;
  ws[addr].s = {
    font:    { bold: true, color: { rgb: 'FFFFFF' } },
    fill:    { fgColor: { rgb: '1E293B' } },  // PlanckOff dark navy
    alignment: { horizontal: 'center', vertical: 'center' },
  };
}
```

**Content-aware column widths (XLS-02):**
```typescript
// Measure header length + sample data length; use max
const colWidths = headers.map((h, idx) => {
  const dataMax = rows.reduce((mx, row) =>
    Math.max(mx, String(row[idx] ?? '').length), 0);
  return { wch: Math.max(h.length + 2, dataMax + 2, 10) };
});
ws['!cols'] = colWidths;
```

---

## 5. Recommended Implementation Approach

### 5.1 New Shared Module: `services/pdfTheme.ts`

Create a single file that exports:

```typescript
// services/pdfTheme.ts

// Brand colors (from tailwind.config.ts primary scale)
export const BRAND_NAVY:  [number, number, number] = [30, 41, 59];   // primary-900 approx
export const BRAND_BLUE:  [number, number, number] = [37, 99, 235];  // primary-600
export const ROW_ALT:     [number, number, number] = [248, 250, 252];

export const MARGIN = 14;  // mm, consistent with current code

export interface PdfTheme {
  headFill:   [number, number, number];
  headText:   [number, number, number];
  altRowFill: [number, number, number];
  margin:     number;
  fontSize:   number;
  cellPadding: number;
}

export const DEFAULT_THEME: PdfTheme = {
  headFill:    BRAND_NAVY,
  headText:    [255, 255, 255],
  altRowFill:  ROW_ALT,
  margin:      MARGIN,
  fontSize:    8,
  cellPadding: 2,
};

export function drawPageHeaderFooter(
  doc: any,            // jsPDF instance
  projectName: string,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  logoBase64?: string,
): void {
  const pageNum   = doc.internal.getCurrentPageInfo().pageNumber;
  const pageCount = doc.internal.getNumberOfPages();

  // Header bar
  if (logoBase64) {
    doc.addImage(logoBase64, 'SVG', margin, 3, 10, 10);
  }
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('PlanckOff', margin + (logoBase64 ? 13 : 0), 9);

  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(reportTitle, pageWidth / 2, 9, { align: 'center' });
  doc.text(exportDate, pageWidth - margin, 9, { align: 'right' });

  // Thin separator line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, 13, pageWidth - margin, 13);

  // Footer
  doc.setFontSize(7); doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(projectName, margin, pageHeight - 5);
  doc.text(`Page ${pageNum} of ${pageCount}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

export function buildAutoTableOptions(
  theme: PdfTheme,
  projectName: string,
  reportTitle: string,
  exportDate: string,
  pageWidth: number,
  pageHeight: number,
  logoBase64?: string,
): Partial<AutoTableOptions> {
  return {
    styles:       { fontSize: theme.fontSize, cellPadding: theme.cellPadding, overflow: 'linebreak' },
    headStyles:   { fillColor: theme.headFill, textColor: theme.headText, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: theme.altRowFill },
    margin:       { left: theme.margin, right: theme.margin, top: 18 },  // top margin leaves room for header
    rowPageBreak: 'avoid',
    didDrawPage: (data: any) => drawPageHeaderFooter(
      data.doc, projectName, reportTitle, exportDate,
      pageWidth, pageHeight, theme.margin, logoBase64
    ),
  };
}
```

**Why this approach:**
- Single source of truth for all colors — change one constant to restyle every export
- `didDrawPage` hook is the correct jsPDF-autotable mechanism for per-page header/footer
- `rowPageBreak: 'avoid'` handles PDF-07 without additional code in each service
- `margin.top: 18` reserves space below the branded header so the table starts below it

### 5.2 Excel Theme Constants (Inline, No New File Needed)

Add to `services/excelTheme.ts` (new small file, or inline in each service):
```typescript
export const XLS_HEADER_FILL = '1E293B';   // same navy as PDF header
export const XLS_HEADER_TEXT = 'FFFFFF';

export function applyHeaderStyling(ws: XLSX.WorkSheet, headers: string[]): void {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font:      { bold: true, color: { rgb: XLS_HEADER_TEXT } },
      fill:      { patternType: 'solid', fgColor: { rgb: XLS_HEADER_FILL } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
  }
}

export function applyFreezePaneAtRow1(ws: XLSX.WorkSheet): void {
  ws['!freeze'] = {
    xSplit: 0, ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen',
  };
}

export function contentAwareColWidths(headers: string[], rows: unknown[][]): XLSX.ColInfo[] {
  return headers.map((h, idx) => {
    const dataMax = rows.reduce((mx, row) =>
      Math.max(mx, String((row as unknown[])[idx] ?? '').length), 0);
    return { wch: Math.max(h.length + 2, Math.min(dataMax + 2, 50), 10) };
  });
}
```

### 5.3 Ordering Fix

At each export entry point, add an explicit order-preservation line:

```typescript
// In reportExportService.ts exportDoorSchedule():
const orderedDoors = [...doors];  // explicit copy preserving call-site order

// In reportExportService.ts exportHardwareSet():
const orderedSets = [...hardwareSets];  // preserve finalJson order

// In pricingReportService.ts exportPricingReportToExcel():
// doors already arrives in the order the caller passes; document explicitly
// const orderedDoors = [...doors]; // preserves UI/final-JSON order — ORD-04
```

For ORD-03 (custom sort order): The DoorScheduleConfig path already respects whatever order `doors` arrives in, and applies any grouping chosen by the user within that order. No additional sort is needed. The key is ensuring the page loads the API data in the same order the UI displays it — which requires auditing `transformDoors()` to confirm it does not re-sort.

---

## 6. Risks & Gotchas

### 6.1 jsPDF SVG Logo Support

jsPDF 4.x supports `doc.addImage(src, 'SVG', x, y, w, h)` for SVG files, but browser support for SVG in jsPDF is inconsistent. The logo at `public/images/logo.svg` should be:
1. Loaded as a base64 string at export time (`fetch('/images/logo.svg').then(r => r.text()).then(svg => btoa(svg))`)
2. Or converted to PNG at build time and embedded as a base64 PNG constant
3. **Recommendation:** Embed as a small PNG constant in `pdfTheme.ts` to avoid async loading during export and cross-browser SVG issues.

### 6.2 Page Count in `didDrawPage`

`doc.internal.getNumberOfPages()` returns the total page count only AFTER the table is fully rendered. During `didDrawPage` callbacks on earlier pages, the total may not yet be final (the table hasn't finished rendering). The correct pattern is a two-pass approach:

```typescript
// After autoTable() completes:
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  doc.setFontSize(7);
  doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
}
```

Alternatively, use `didDrawPage` with a placeholder and do a second pass — but the simpler two-pass approach (draw content in `didDrawPage`, then add page numbers in a loop after) is more reliable.

### 6.3 DoorScheduleConfig Export Path Is Inline

`DoorScheduleConfig.tsx` contains all its export logic inline (lines 335–723). This makes it hard to import `pdfTheme.ts` cleanly. The plan should be:
1. Import `buildAutoTableOptions` from `pdfTheme.ts` at the top of the component
2. Spread its return value into the existing `autoTable()` call, overriding only the fields that need to stay component-specific (like `columnStyles`, `startY`, `tableWidth`)

Do NOT extract the export logic into a separate function during this phase — that is a larger refactor and could break the complex JSZip image injection path.

### 6.4 Submittal Package Uses `react-to-print`, Not jsPDF

`SubmittalGenerator.tsx` uses `react-to-print`. This PDF path cannot benefit from jsPDF theme changes. The requirements (PDF-01 through PDF-07) and VER-01 explicitly list "Door Schedule, Hardware Sets, Pricing" for verification — NOT the submittal package. No changes to `SubmittalGenerator.tsx` are needed for this phase.

The `exportSubmittalPackageToPDF()` in `pdfExportService.ts` is a dead code path (not called from anywhere in the UI). It should be left alone unless explicitly descoped.

### 6.5 xlsx `cellStyles: true` Flag

Current Door Schedule Excel export does NOT pass `cellStyles: true` to `XLSX.write()`, silently dropping the `cell.s` styling applied to header cells. Every export path that uses `cell.s` styling must include `cellStyles: true` in the write options. This applies to:
- `DoorScheduleConfig.tsx` line ~425: `XLSX.write(wb, { type: 'array', bookType: 'xlsx' })` → must add `cellStyles: true`
- All other XLSX paths that will receive new styling

### 6.6 ExcelJS Bundling Issue (Why We Stay on xlsx)

The comment in `DoorScheduleConfig.tsx` at line 360 is authoritative: "ExcelJS has bundling issues in Next.js browser context." ExcelJS uses Node.js streams internally and does not bundle cleanly with Next.js's browser bundle even with `transpilePackages`. Do NOT attempt to use ExcelJS for any export in this phase.

### 6.7 HardwareSet Export Uses Two Separate Entry Points

The Hardware Set export can be triggered from TWO different UI paths:
1. `/project/[id]/reports/hardware-set` → `HardwareSetReportPage.handleExport()` → `exportHardwareSet()` in `reportExportService.ts`
2. `/project/[id]/reports` → `ReportsView.handleHardwareSetExport()` → `exportHardwareSet()` in `reportExportService.ts`

Both call the same `exportHardwareSet()` function, which delegates to `exportHardwareSetToPDF()` or `exportHardwareSetToExcel()`. Only one fix is needed at the service layer.

### 6.8 pdfExportService vs DoorScheduleConfig — Two Door Schedule PDF Paths

There are TWO separate functions that export a Door Schedule PDF:
1. `exportDoorScheduleToPDF()` in `pdfExportService.ts` (line 718) — called via `reportExportService.exportDoorSchedule()` when format is 'pdf'
2. Inline PDF generation inside `DoorScheduleConfig.handleDownload()` — the primary current path for the door-schedule report page

The `DoorScheduleConfig` download path is the one currently used in production. The `pdfExportService.exportDoorScheduleToPDF()` is also called via `reportExportService.exportDoorSchedule()`, but `DoorScheduleConfig` does NOT call `exportDoorSchedule()` — it has its own inline download handler. Both paths must be updated.

### 6.9 pricingReportService Has No PDF Path

`pricingReportService.ts` only exports Excel and CSV. There is no PDF export for pricing. This is consistent with the pricing route only showing Excel/CSV exports. No PDF changes are needed in this service.

---

## 7. Files That Will Change

### New Files (Create)
| File | Purpose |
|------|---------|
| `services/pdfTheme.ts` | Shared brand constants + `drawPageHeaderFooter()` + `buildAutoTableOptions()` |
| `services/excelTheme.ts` | Shared Excel header styling + freeze pane + content-aware widths helpers |

### Modified Files
| File | Changes Required | Req IDs |
|------|-----------------|---------|
| `components/doorSchedule/DoorScheduleConfig.tsx` | Import `pdfTheme.ts`; update `autoTable()` call to use `buildAutoTableOptions()`; fix `cellStyles: true` in XLSX write; apply `applyHeaderStyling()` + `applyFreezePaneAtRow1()` + content-aware widths to Excel path | PDF-01–07, XLS-01–03, ORD-01–04 |
| `services/pdfExportService.ts` | Import `pdfTheme.ts`; update `exportDoorScheduleToPDF()`, `exportHardwareSetToPDF()`, `exportSubmittalPackageToPDF()` to use `buildAutoTableOptions()`; unify header colors | PDF-01–07 |
| `services/excelExportService.ts` | Import `excelTheme.ts`; apply header styling, freeze pane, content-aware widths to `exportDoorScheduleToExcel()`, `exportHardwareSetToExcel()`, `createComprehensiveDoorScheduleSheet()`, `createComprehensiveHardwareScheduleSheet()`, `createFrameDetailsSheet()`, `createProcurementSummarySheet()` | XLS-01–03 |
| `services/pricingReportService.ts` | Import `excelTheme.ts`; apply header styling, freeze pane, content-aware widths to all 5 sheet-creation functions | XLS-01–03 |
| `services/reportExportService.ts` | Add explicit `[...doors]` / `[...hardwareSets]` order-preservation guards at entry points | ORD-01–04 |

### Files That Do NOT Need to Change
| File | Reason |
|------|--------|
| `components/submittals/SubmittalGenerator.tsx` | Uses `react-to-print`, not jsPDF; VER-01 does not require submittal verification |
| `services/csvExportService.ts` | CSV format, not in scope for beautification |
| `services/cobieExportService.ts` | COBie export, specialized format, not in requirements |
| `app/project/[id]/reports/door-schedule/page.tsx` | Data loading page, no export logic |
| `app/project/[id]/reports/hardware-set/page.tsx` | Data loading page, no export logic |
| `app/project/[id]/reports/pricing/page.tsx` | Data loading page, no export logic |
| `utils/hardwareTransformers.ts` | Transforms data; ordering depends on whether API returns data in UI order — audit only, no change expected |

---

## Standard Stack

### Core Export Libraries
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `jspdf` | 4.0.0 | PDF generation, coordinate-based drawing | Installed, in use |
| `jspdf-autotable` | 5.0.7 | Table rendering plugin for jsPDF | Installed, in use |
| `xlsx` (SheetJS) | 0.18.5 | Excel workbook read/write | Installed, in use |
| `jszip` | 3.10.1 | OOXML manipulation for Excel image injection | Installed, in use (DoorScheduleConfig) |
| `file-saver` | 2.0.5 | Browser file download | Installed, in use (some paths) |

### Libraries to Avoid
| Library | Reason |
|---------|--------|
| `exceljs` | Installed but has Next.js browser bundling issues — do not use for client-side export |
| New PDF libraries | No new frameworks per project constraints |

---

## Architecture Patterns

### Recommended Pattern: Shared Theme Module + Decorator Pattern
```
services/pdfTheme.ts       ← defines constants + drawPageHeaderFooter() + buildAutoTableOptions()
  ↑ imported by
  ├── components/doorSchedule/DoorScheduleConfig.tsx (inline export)
  ├── services/pdfExportService.ts
  └── (not needed by submittal, which uses react-to-print)

services/excelTheme.ts     ← defines applyHeaderStyling() + applyFreezePaneAtRow1() + contentAwareColWidths()
  ↑ imported by
  ├── components/doorSchedule/DoorScheduleConfig.tsx (excel path)
  ├── services/excelExportService.ts
  └── services/pricingReportService.ts
```

### Anti-Pattern to Avoid
- Do NOT inline the logo as a fetch call inside each export function — the fetch is async and adds latency. Pre-import the logo as a base64 constant.
- Do NOT try to use ExcelJS for any part of this phase.
- Do NOT move DoorScheduleConfig export logic to a service module in this phase — that is a separate refactor with risk of breaking the JSZip image path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Row pagination without cutoffs | Custom page-break detection | `rowPageBreak: 'avoid'` in jsPDF-autotable |
| Repeating column headers | Manual header re-draw on each page | `repeatHeaders: true` (default in v5.x) |
| Table layout within PDF | Manual cell positioning | `autoTable()` with `columnStyles` |
| Page number injection | Manual page tracking | `didDrawPage` callback + post-table page loop |
| Excel freeze pane | Manual row pinning | `ws['!freeze']` property |

---

## Common Pitfalls

### Pitfall 1: `cellStyles: true` Missing from xlsx Write
**What goes wrong:** Bold and colored header cells in xlsx are silently dropped
**Why it happens:** SheetJS only writes cell style information when explicitly told to
**How to avoid:** Add `cellStyles: true` to every `XLSX.write()` call
**Warning signs:** Excel file opens but headers appear unstyled

### Pitfall 2: Page Count Wrong in First-Pass `didDrawPage`
**What goes wrong:** Footer shows "Page 1 of 1" on all pages
**Why it happens:** `getNumberOfPages()` during rendering doesn't yet know the final count
**How to avoid:** Use a two-pass approach: draw header/content in `didDrawPage`, then loop through all pages after `autoTable()` returns to write "Page X of Y"

### Pitfall 3: startY Overlaps with Branded Header
**What goes wrong:** Table content drawn on top of the branded header
**Why it happens:** `startY` not updated to account for header height
**How to avoid:** Set `margin.top: 18` in `buildAutoTableOptions()` so autotable leaves room for the header bar

### Pitfall 4: SVG Logo Fails in jsPDF
**What goes wrong:** Logo not rendered in PDF or throws error
**Why it happens:** jsPDF SVG support is inconsistent across browsers
**How to avoid:** Convert logo to base64 PNG constant (small size, ~20x20px); embed in `pdfTheme.ts`

### Pitfall 5: ExcelJS Import Breaking the Browser Bundle
**What goes wrong:** Build fails or runtime error in browser
**Why it happens:** ExcelJS uses Node.js stream internals
**How to avoid:** Do not import ExcelJS anywhere in client-side code; it is only safe server-side

### Pitfall 6: Two Door-Schedule PDF Code Paths Diverge After Phase
**What goes wrong:** The styled template is applied to one PDF path but not the other
**Why it happens:** Both `DoorScheduleConfig.tsx` (inline) and `pdfExportService.exportDoorScheduleToPDF()` generate door schedule PDFs
**How to avoid:** Both must import `pdfTheme.ts` and call `buildAutoTableOptions()` — verify both in VER-01

---

## Validation Architecture

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | How to Verify |
|--------|----------|-----------|---------------|
| PDF-01 | All PDFs share one visual template | Manual visual | Export from all 3 types; compare fonts, colors, header/footer |
| PDF-02 | Branded header on every PDF | Manual visual | Check logo, project name, export date on page 1 AND page 2+ |
| PDF-03 | Footer with page numbers | Manual visual | Check "Page X of Y" on every page |
| PDF-04 | Column headers styled | Manual visual | Check header row fill color and text color |
| PDF-05 | Alternating row shading | Manual visual | Check every other row has subtle background |
| PDF-06 | Headers repeat on each page | Manual visual | Export 20+ doors; verify page 2 has column headers |
| PDF-07 | No row cutoffs at page boundary | Manual visual | Export 20+ doors; verify no row splits mid-record |
| XLS-01 | Bold colored header row | Manual visual | Open Excel; check row 1 has bold text + fill color |
| XLS-02 | Sensible column widths | Manual visual | Check columns size to content, no truncation |
| XLS-03 | Frozen header row | Manual visual | Scroll down in Excel; verify row 1 stays visible |
| ORD-01 | Door schedule export order matches UI | Manual | Reorder doors in UI; export; verify same order in file |
| ORD-02 | Hardware set export order matches UI | Manual | Check hardware set order in export vs. UI display |
| ORD-03 | Custom sort preserved in export | Manual | Apply sort in UI; export; verify order |
| ORD-04 | Explicit order-preservation guard in code | Code review | Verify `[...arr]` pattern at all export entry points |
| VER-01 | All verified across Door, Hardware, Pricing | Manual | Run verification checklist for all 3 types |

**Note:** No automated test framework is configured (zero test files, Vitest not installed). All verification is manual inspection.

---

## Open Questions

1. **Logo embedding in PDF**
   - What we know: SVG logo exists at `public/images/logo.svg`
   - What's unclear: Whether jsPDF 4.0.0 can render SVGs reliably in all target browsers
   - Recommendation: Pre-convert to a small base64 PNG constant; embed in `pdfTheme.ts`

2. **Does the `reportExportService.exportDoorSchedule()` function get called from the Door Schedule report page?**
   - What we know: `DoorScheduleConfig` has its own inline download handler that does NOT call `reportExportService`
   - What's unclear: Whether there is any code path still routing through `reportExportService.exportDoorSchedule()` for the door schedule
   - Recommendation: Treat both `pdfExportService.exportDoorScheduleToPDF()` AND `DoorScheduleConfig` inline path as active; fix both

3. **Pricing PDF export**
   - What we know: `pricingReportService.ts` has only Excel/CSV exports, no PDF
   - What's unclear: Is there a pricing PDF requirement? Requirements say "Pricing" in VER-01 but the service has no PDF
   - Recommendation: VER-01 likely refers to the pricing Excel export for the XLS-0X requirements and does not require a new PDF path for pricing

---

## Sources

### Primary (HIGH confidence — verified by reading source files)
- `services/pdfExportService.ts` — complete export logic, colors, structure
- `services/excelExportService.ts` — complete export logic, xlsx usage
- `services/pricingReportService.ts` — pricing Excel export, xlsx usage
- `services/csvExportService.ts` — CSV export
- `services/reportExportService.ts` — orchestration layer, data flow
- `components/doorSchedule/DoorScheduleConfig.tsx` — primary inline export (pdf + excel), 900 lines
- `components/submittals/SubmittalGenerator.tsx` — react-to-print pattern
- `app/project/[id]/reports/door-schedule/page.tsx` — route page, data loading
- `app/project/[id]/reports/hardware-set/page.tsx` — route page, data loading
- `app/project/[id]/reports/submittal-package/page.tsx` — route page, finalJson data flow
- `views/ReportsView.tsx` — legacy report selection + export trigger
- `tailwind.config.ts` — brand color palette
- `package-lock.json` — exact installed versions (jspdf: 4.0.0, jspdf-autotable: 5.0.7, exceljs: 4.4.0, xlsx: 0.18.5)
- `.planning/codebase/CONCERNS.md` — xlsx unmaintained note, ExcelJS migration note

---

## Metadata

**Confidence breakdown:**
- Current export architecture: HIGH — read all service files directly
- Data flow & ordering: HIGH — traced through all layers; risks identified
- Library capabilities: HIGH — based on actual package versions confirmed from lockfile
- UI entry points: HIGH — read all route pages and views
- Files that will change: HIGH — confirmed by reading each file
- Implementation recommendations: MEDIUM — patterns are standard for these libraries but not validated by running the code

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable libraries; unlikely to change)
