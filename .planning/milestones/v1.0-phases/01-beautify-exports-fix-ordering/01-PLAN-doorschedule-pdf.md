# Plan: Apply PDF Theme to Door Schedule Export (Path A — DoorScheduleConfig inline)

**Phase:** 1 — Beautify Exports & Fix Ordering
**Goal:** Refactor the inline PDF export in `DoorScheduleConfig.tsx` to use `pdfTheme.ts`, add the branded header/footer, and insert the ORD-04 order-preservation guard.
**Requirements:** PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, PDF-07, ORD-01, ORD-03, ORD-04
**Dependencies:** Plan 1 (pdf-theme) must be complete — `services/pdfTheme.ts` must exist before this plan runs.

---

## Context

**Files to read before starting:**
- `services/pdfTheme.ts` — read the full file. You need the exact export names: `buildAutoTableOptions`, `addPageNumbers`, `DEFAULT_THEME`, `PDF_MARGIN`, `HEADER_BAR_HEIGHT`.
- `components/doorSchedule/DoorScheduleConfig.tsx` lines 335–720 — the entire `handleDownload()` function. Focus on:
  - Lines 536–640: the PDF branch (`else` block after the Excel check). This is the target of all PDF changes.
  - Line 554: `const doc = new jsPDF(...)` — note the dynamic import pattern used here.
  - Lines 606–640: the `for` loop over groups and the `autoTable()` call that must be updated.
  - Lines 612–616: the manual title/subtitle text drawn with `doc.text()` — this manual header will be REPLACED by `drawPageHeader` via `didDrawPage`. Remove lines 612–616 and the `yPosition`-style manual header block; the theme header now fires automatically.
  - Line 618: `autoTable(doc, { startY: 25, ... })` — `startY` must change to `HEADER_BAR_HEIGHT + 2` (i.e., `20`) so the table starts below the branded header.
  - Lines 631–639: the hardcoded `headStyles`, `alternateRowStyles`, and `margin` — these are replaced by spreading `buildAutoTableOptions()`.

**Key constraints:**
- Do NOT extract the export logic out of `DoorScheduleConfig.tsx` into a separate service file. That is a larger refactor with risk to the JSZip image injection path.
- Do NOT remove or alter the JSZip OOXML image injection logic (lines ~362–534). That is the Excel branch and must remain untouched.
- Do NOT remove `tableWidth: USABLE_W` or `columnStyles: pdfColumnStyles` from the `autoTable()` call — those are caller-specific overrides that `buildAutoTableOptions()` does not set.
- The `fontSize` and `cellPadding` in `DoorScheduleConfig` are computed dynamically based on column count (lines 551–552). Pass them as a custom theme override, not the `DEFAULT_THEME` values.
- The elevation image pages (lines 642–720) draw their own page header via `addElevPageHeader()`. Update that function to call `drawPageHeader()` from pdfTheme so elevation pages are also branded.
- After all `autoTable()` calls complete, call `addPageNumbers()` once, passing the full `doc`, `projectName`, page width, page height, and `PDF_MARGIN`.
- ORD-04 guard: add `const orderedDoors = [...includedDoors]` immediately before line 343 (`const groupsToExport = ...`). Replace references to `includedDoors` inside the fallback group with `orderedDoors`. Add a comment: `// ORD-04: explicit spread preserves call-site array order`.

---

## Tasks

### Task 1: Add the import for pdfTheme

At the top of `components/doorSchedule/DoorScheduleConfig.tsx`, add the following import after the existing service/utility imports:

```typescript
import {
  buildAutoTableOptions,
  addPageNumbers,
  DEFAULT_THEME,
  PDF_MARGIN,
  HEADER_BAR_HEIGHT,
} from '../../services/pdfTheme';
```

Confirm `../../services/pdfTheme` resolves correctly from `components/doorSchedule/` — that path goes up two levels to the project root then into `services/`. If the project uses path aliases (`@/services/pdfTheme`), use the alias instead.

### Task 2: Add the ORD-04 order-preservation guard

Locate the line inside `handleDownload()` (around line 343):
```typescript
const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: includedDoors }];
```

Immediately BEFORE that line, insert:
```typescript
// ORD-04: explicit spread preserves call-site array order — no implicit reordering
const orderedDoors = [...includedDoors];
```

Then update the fallback object to use `orderedDoors` instead of `includedDoors`:
```typescript
const groupsToExport = visibleGroups.length > 0 ? visibleGroups : [{ breadcrumb: [], doors: orderedDoors }];
```

`visibleGroups` already preserves the `groups` order from `useDoorAggregation`, so no change needed for the non-fallback branch. Add a comment above the line: `// ORD-01/03: visibleGroups preserves UI display order from useDoorAggregation`.

### Task 3: Replace the manual per-group header and update the autoTable call

The current code (starting around line 606) looks like this for each iteration of `for (const [i, group] of groupsToExport.entries())`:

```typescript
if (i > 0) doc.addPage();

const title    = projectName || 'Door-Frame Reports';
const subtitle = group.breadcrumb.length > 0 ? group.breadcrumb.join(' › ') : 'All Doors';

doc.setFontSize(11); doc.setFont('helvetica', 'bold');
doc.text(title, MARGIN, 14);
doc.setFontSize(8);  doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
doc.text(`${subtitle}  —  ${sumDoorQuantities(group.doors)} ...`, MARGIN, 20);
doc.setTextColor(0);

autoTable(doc, {
  startY: 25,
  head: [pdfHeaders],
  body: rowsByGroup[i].map(...),
  tableWidth: USABLE_W,
  columnStyles: pdfColumnStyles,
  styles:       { fontSize, cellPadding, overflow: 'linebreak' },
  headStyles:   { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize, halign: 'center' },
  alternateRowStyles: { fillColor: [248, 250, 252] },
  margin: { left: MARGIN, right: MARGIN },
});
```

Replace the block above (the `doc.text` calls AND the `autoTable` call) with:

```typescript
if (i > 0) doc.addPage();

const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
const subtitle   = group.breadcrumb.length > 0 ? group.breadcrumb.join(' › ') : 'All Doors';
const reportTitle = `Door Schedule — ${subtitle} (${sumDoorQuantities(group.doors)} doors)`;

// Build a custom theme to preserve the dynamic fontSize/cellPadding for this column density
const groupTheme = {
  ...DEFAULT_THEME,
  fontSize,
  cellPadding,
};

autoTable(doc, {
  ...buildAutoTableOptions(groupTheme, reportTitle, exportDate, PAGE_W, PDF_MARGIN),
  startY:       HEADER_BAR_HEIGHT + 2,  // leave room for branded header (replaces hardcoded 25)
  head:         [pdfHeaders],
  body:         rowsByGroup[i].map(row =>
    selectedColumns.map(col => getRowValue(row, col) || '—'),
  ),
  tableWidth:   USABLE_W,
  columnStyles: pdfColumnStyles,
  // fontSize/cellPadding already in groupTheme via buildAutoTableOptions → styles
});
```

### Task 4: Add `addPageNumbers` call after all groups are rendered

After the closing brace of the `for (const [i, group] of groupsToExport.entries())` loop (and after any elevation image pages appended inside the loop), add:

```typescript
// Add page numbers to all pages (two-pass: autoTable is fully rendered now)
addPageNumbers(doc, projectName || 'Door Schedule', PAGE_W, PAGE_H, PDF_MARGIN);
```

Then add the `doc.save()` call as it currently exists (no change needed there).

### Task 5: Brand the elevation image page header

Locate the inner function `addElevPageHeader` (around line 663):
```typescript
const addElevPageHeader = (sub: string) => {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
    doc.text(title, MARGIN, 14);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
    doc.text(`${sub}  —  Elevation Types`, MARGIN, 20);
    doc.setTextColor(0);
};
```

Replace the body of this function with a call to `drawPageHeader` from pdfTheme:
```typescript
import { drawPageHeader } from '../../services/pdfTheme'; // add to imports at top if not already included
```

Update `addElevPageHeader`:
```typescript
const addElevPageHeader = (sub: string) => {
    const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    drawPageHeader(doc, `Elevation Types — ${sub}`, exportDate, PAGE_W, PDF_MARGIN);
};
```

Add `drawPageHeader` to the import statement from `pdfTheme` (Task 1 import).

---

## Verification

- [ ] `npx tsc --noEmit` produces zero new errors.
- [ ] Trigger a Door Schedule PDF export in the browser (route: `/project/[id]/reports/door-schedule`). Download and open the PDF.
- [ ] Page 1 shows: PlanckOff logo (or placeholder), "PlanckOff" brand name, report title centered, today's date right-aligned, a thin horizontal separator line below the header bar.
- [ ] Page 1 table: header row is dark navy background with white bold text. Alternating rows have a subtle off-white fill.
- [ ] Footer on every page shows: project name left, "Page X of Y" centered. Page numbers are correct (not "Page 1 of 1" on all pages).
- [ ] Export a Door Schedule with enough doors to span multiple pages. Verify: column headers repeat at the top of page 2+. No row is split mid-record at a page boundary.
- [ ] Elevation image pages (when elevation images are enabled) show the same branded header bar at the top.
- [ ] The MARGIN and USABLE_W constants inside `handleDownload` are still the local `MARGIN = 14` (unchanged). The imported `PDF_MARGIN` is passed to pdfTheme functions — both equal 14, which is correct.
- [ ] Existing Excel export from the Door Schedule page is unaffected (Excel branch not touched).
