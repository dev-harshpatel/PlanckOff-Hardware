# Plan: Apply PDF Theme to Hardware Set Export (Path B — pdfExportService)

**Phase:** 1 — Beautify Exports & Fix Ordering
**Goal:** Refactor `services/pdfExportService.ts` to use `pdfTheme.ts` for all jsPDF export functions, replacing three inconsistent hardcoded color values with the shared theme, and add the branded header/footer to Hardware Set PDFs.
**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, ORD-01, ORD-02, ORD-04
**Dependencies:** Plan 1 (pdf-theme) must be complete — `services/pdfTheme.ts` must exist before this plan runs.

---

## Context

**Files to read before starting:**
- `services/pdfTheme.ts` — full file. Required exports: `buildAutoTableOptions`, `addPageNumbers`, `drawPageHeader`, `DEFAULT_THEME`, `PDF_MARGIN`, `HEADER_BAR_HEIGHT`.
- `services/pdfExportService.ts` — read the full file (~711 lines). Key sections:
  - Lines 1–13: existing imports. You will add the pdfTheme import here.
  - `exportDoorScheduleToPDF()` — starts around line 100. Current: `headStyles.fillColor: [59, 130, 246]` (blue). Replace with theme.
  - `exportHardwareSetToPDF()` — starts around line 279. Current: `headStyles.fillColor: [147, 51, 234]` (purple). Replace with theme. This function has two `autoTable()` calls: one for the flat list (line 317) and one inside the grouped `forEach` loop (line 385). Both must be updated.
  - `exportSubmittalPackageToPDF()` — starts around line 430. Current: `headStyles.fillColor: [66, 139, 202]` (a third blue). Replace with theme. Note: this function is dead code (not called from UI) but must be updated for consistency so PDF-01 is fully satisfied.
  - Manual header text drawn via `doc.setFontSize` + `doc.text` calls near the top of each function (e.g., lines 292–309 in exportHardwareSetToPDF). These are replaced by the `didDrawPage` hook in `buildAutoTableOptions`.
- `services/reportExportService.ts` lines 61–90 — the `exportDoorSchedule()` and `exportHardwareSet()` orchestration functions. The ORD-04 guards go here.

**Key constraints:**
- `exportHardwareSetToPDF` contains two separate `autoTable()` calls (flat list path and grouped path). Both must use `buildAutoTableOptions()` — do not miss the second one.
- The `yPosition` variable used for manual header text in `exportHardwareSetToPDF` (lines 292–309) must be recalculated. The branded header now occupies `HEADER_BAR_HEIGHT` (18mm) at the top automatically. Remove the manual `doc.text()` header block. Set `startY: HEADER_BAR_HEIGHT + 2` on the first `autoTable()` call. For subsequent groups, use `(doc as any).lastAutoTable.finalY + 10` as `startY` (unchanged).
- `addPageNumbers()` must be called ONCE after all `autoTable()` calls for a given document are complete — i.e., after the `groups.forEach` loop finishes in the grouped path, and after the single `autoTable()` in the flat path.
- The `exportDoorScheduleToPDF()` in pdfExportService.ts is a separate code path from the inline export in DoorScheduleConfig.tsx (which Plan 3 covers). Both must be updated — they share the same theme module but are independent functions.
- ORD-04 guards go in `reportExportService.ts`, not in `pdfExportService.ts`. The service functions receive already-ordered arrays from the orchestration layer.

---

## Tasks

### Task 1: Add the pdfTheme import to `pdfExportService.ts`

At the top of `services/pdfExportService.ts`, after the existing imports, add:

```typescript
import {
  buildAutoTableOptions,
  addPageNumbers,
  drawPageHeader,
  DEFAULT_THEME,
  PDF_MARGIN,
  HEADER_BAR_HEIGHT,
} from './pdfTheme';
```

### Task 2: Refactor `exportDoorScheduleToPDF()`

Locate `exportDoorScheduleToPDF()` in `pdfExportService.ts`. The function currently:
1. Creates a `jsPDF` doc.
2. Draws a manual text header with `doc.text()`.
3. Calls `autoTable()` with `headStyles.fillColor: [59, 130, 246]`.
4. Saves the file.

Make the following changes:

**a) Remove the manual text header block.** Delete any lines between `const doc = new jsPDF(...)` and the first `autoTable()` call that use `doc.setFontSize`, `doc.setFont`, `doc.text` for drawing the page title/date. The branded header now fires automatically via `didDrawPage`.

**b) Update the `autoTable()` call.** Replace the hardcoded style properties with the theme:

```typescript
const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const pageWidth  = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();

autoTable(doc, {
  ...buildAutoTableOptions(DEFAULT_THEME, 'Door Schedule', exportDate, pageWidth, PDF_MARGIN),
  startY: HEADER_BAR_HEIGHT + 2,
  head:   [headers],
  body:   rows,
  // Keep any existing columnStyles or margin overrides specific to this function
});
```

**c) Add `addPageNumbers()` after the `autoTable()` call, before `doc.save()`:
```typescript
addPageNumbers(doc, projectName, pageWidth, pageHeight, PDF_MARGIN);
doc.save(filename);
```

### Task 3: Refactor `exportHardwareSetToPDF()`

This function has two `autoTable()` paths (flat and grouped). Both must be updated.

**a) Remove the manual header block** (lines ~292–309, the `doc.setFontSize` / `doc.text` block that writes project name, "Hardware Set Report", and generated date). Delete it entirely.

**b) Compute shared variables** immediately after `const doc = new jsPDF(...)`:
```typescript
const exportDate  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const pageWidth   = doc.internal.pageSize.getWidth();
const pageHeight  = doc.internal.pageSize.getHeight();
const themeOpts   = buildAutoTableOptions(DEFAULT_THEME, 'Hardware Set Report', exportDate, pageWidth, PDF_MARGIN);
```

**c) Update the FLAT path `autoTable()` call** (currently at line ~317):
```typescript
autoTable(doc, {
  ...themeOpts,
  startY: HEADER_BAR_HEIGHT + 2,
  head:   [headers],
  body:   rows,
  // Remove: styles, headStyles, alternateRowStyles, margin (now in themeOpts)
  // Keep: any columnStyles specific to this report
});
addPageNumbers(doc, projectName, pageWidth, pageHeight, PDF_MARGIN);
```

**d) Update the GROUPED path `autoTable()` calls** (each iteration of `groups.forEach`). Currently at line ~385:

For the FIRST group (`isFirstGroup === true`): set `startY: HEADER_BAR_HEIGHT + 2`.
For subsequent groups: keep the existing `startY: yPosition` logic (derived from `(doc as any).lastAutoTable.finalY + 10`) — this is correct.

Replace the `headStyles.fillColor: [147, 51, 234]` with the spread:
```typescript
autoTable(doc, {
  ...themeOpts,
  startY: isFirstGroup ? HEADER_BAR_HEIGHT + 2 : yPosition,
  head:   [headers],
  body:   rows,
  // Remove: hardcoded headStyles, alternateRowStyles, margin, styles
});
```

After the `groups.forEach` loop closes (outside the forEach, not inside), add page numbers once:
```typescript
addPageNumbers(doc, projectName, pageWidth, pageHeight, PDF_MARGIN);
doc.save(filename);
```

### Task 4: Refactor `exportSubmittalPackageToPDF()` (dead code path — consistency only)

This function is not called from any active UI path, but it must be updated so PDF-01 is fully satisfied (all jsPDF functions share the same template).

Locate the `autoTable()` call(s) inside `exportSubmittalPackageToPDF()`. Replace `headStyles.fillColor: [66, 139, 202]` (and any other hardcoded color values) with:
```typescript
...buildAutoTableOptions(DEFAULT_THEME, 'Submittal Package', exportDate, pageWidth, PDF_MARGIN),
```

Where `exportDate` and `pageWidth` are derived from `new Date()` and `doc.internal.pageSize.getWidth()` respectively.

Add `addPageNumbers()` before `doc.save()` in this function as well.

### Task 5: Add ORD-04 guards in `reportExportService.ts`

Open `services/reportExportService.ts`. Locate:

**`exportDoorSchedule()` function** (around line 62):
```typescript
export const exportDoorSchedule = async (
  doors: Door[],
  config: DoorScheduleExportConfig,
  projectName: string,
  elevationTypes: ElevationType[] = [],
): Promise<void> => {
  try {
    switch (config.format) {
      case 'xlsx':
        await exportDoorScheduleToExcel(doors, config, projectName, elevationTypes);
```

Immediately after `try {` and before the `switch`, insert:
```typescript
// ORD-04: explicit spread preserves call-site array order (UI display order)
const orderedDoors = [...doors];
```

Then replace `doors` with `orderedDoors` in all three `case` branches (`exportDoorScheduleToExcel(orderedDoors, ...)`, `exportDoorScheduleToPDF(orderedDoors, ...)`, `exportDoorScheduleToCSV(orderedDoors, ...)`).

**`exportHardwareSet()` function** — locate its definition (search for `exportHardwareSet`). After the function signature opens, before calling `calculateHardwareUsage`, insert:
```typescript
// ORD-04: explicit spreads preserve call-site array order
const orderedDoors       = [...doors];
const orderedHardwareSets = [...hardwareSets];
```

Replace `doors` and `hardwareSets` with `orderedDoors` and `orderedHardwareSets` in the `calculateHardwareUsage()` call.

---

## Verification

- [ ] `npx tsc --noEmit` produces zero new errors.
- [ ] Trigger a Hardware Set PDF export from `/project/[id]/reports/hardware-set`. Download and open.
- [ ] Branded header is present on every page: PlanckOff logo area, "PlanckOff" text, "Hardware Set Report" centered, today's date right-aligned, separator line.
- [ ] Header row is dark navy with white bold text (NOT the old purple `[147, 51, 234]`).
- [ ] Alternating rows have subtle off-white shading.
- [ ] Footer on every page: project name left, "Page X of Y" centered with correct total.
- [ ] Export with enough hardware items to span 2+ pages. Column headers repeat on page 2+. No row is cut mid-record at a page break.
- [ ] Open `services/pdfExportService.ts` and confirm zero occurrences of `[147, 51, 234]`, `[59, 130, 246]`, or `[66, 139, 202]` remain. Use a file search to confirm.
- [ ] Open `services/reportExportService.ts` and confirm `[...doors]` and `[...hardwareSets]` guards exist at both export entry points.
- [ ] The Door Schedule export from `/project/[id]/reports/door-schedule` (DoorScheduleConfig inline path) is unaffected — the two paths are independent functions.
