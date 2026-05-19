# Plan: Manual Verification Across All Export Types (VER-01)

**Phase:** 1 — Beautify Exports & Fix Ordering
**Goal:** Systematically verify all 14 preceding requirements across the three target export types (Door Schedule, Hardware Sets, Pricing) using a structured manual checklist, and confirm no regression on existing functionality.
**Requirements:** VER-01 (and implicitly validates PDF-01 through PDF-07, XLS-01 through XLS-03, ORD-01 through ORD-04)
**Dependencies:** Plans 1, 2, 3, 4, 5 must all be complete before this verification plan runs.

---

## Context

**Files to read before starting:**
- None — this plan is a verification-only checklist. No code changes are expected. If you find a defect, note it and fix it in the relevant source file before marking the checklist item complete.

**Key constraints:**
- All verification is manual (no automated test framework is configured — zero test files, Vitest not installed).
- You need a project in the application with at least 20 doors and at least one hardware set with multiple items to trigger multi-page PDF output. Use a real project or create a test project with sufficient data.
- The submittal package export (via `react-to-print`) is explicitly out of scope for this verification — VER-01 requires verification of Door Schedule, Hardware Sets, and Pricing only.
- If a checklist item fails, note the failing behavior in a comment, identify the relevant source file and function, fix the code, re-run `npx tsc --noEmit`, and re-check the item before proceeding.

---

## Tasks

### Task 1: Setup — prepare a test project with sufficient data

Before running the checklist, confirm you have access to a project that has:
- At least 20 doors (to generate a multi-page PDF — at roughly 30 rows per page, 20 doors should be enough with a dense column selection)
- At least one hardware set with 15+ hardware items
- Pricing data with at least one door line item and one hardware line item

If no such project exists, create one with representative data through the UI. Note the project ID for use in the routes below.

### Task 2: Run the PDF verification checklist

Open the application and navigate to the Door Schedule report for your test project: `/project/[YOUR_PROJECT_ID]/reports/door-schedule`

**Door Schedule PDF — export a PDF with all columns selected and "Show Elevation Images" off:**

- [ ] **PDF-02 (header — page 1):** Page 1 has a branded header at the top. Header contains: a logo area (placeholder or real logo), the text "PlanckOff", a report title centered (e.g., "Door Schedule — All Doors"), and today's date right-aligned.
- [ ] **PDF-02 (header — page 2+):** Navigate to a page after page 1. The same branded header appears at the top. It is NOT absent on subsequent pages.
- [ ] **PDF-03 (footer):** Every page has a footer. Footer shows the project name on the left and "Page X of Y" centered. The page count Y is correct (matches the total page count, not "1" on all pages).
- [ ] **PDF-04 (column headers styled):** The first row of the table has a dark navy background (`#1E293B`) with white bold text. It is clearly distinguishable from data rows.
- [ ] **PDF-05 (alternating row shading):** Odd data rows have a subtle off-white/light gray fill. Even rows are white. The pattern is consistent throughout the table.
- [ ] **PDF-06 (repeated column headers):** On page 2 (and page 3+ if applicable), the column header row appears at the top of the table — not just on page 1. Scroll through a multi-page export to confirm.
- [ ] **PDF-07 (no row cutoffs):** Inspect the bottom of pages 1, 2, etc. No door entry is cut off mid-row at a page boundary. Each row either fits fully on one page or starts fresh on the next.

Navigate to the Hardware Set report: `/project/[YOUR_PROJECT_ID]/reports/hardware-set`

**Hardware Set PDF — export a PDF (flat grouping, all optional columns selected):**

- [ ] **PDF-01 (visual consistency):** Side-by-side compare the Door Schedule PDF and the Hardware Set PDF. They must have identical: header layout and colors, footer layout, table header fill color (both dark navy — NOT purple), alternating row colors, font sizes, separator line below header.
- [ ] **PDF-02 (header present):** Branded header visible on page 1 of the Hardware Set PDF.
- [ ] **PDF-03 (footer present):** "Page X of Y" footer on every Hardware Set PDF page.
- [ ] **PDF-04 through PDF-07:** Apply the same checklist items as Door Schedule above to the Hardware Set PDF.

### Task 3: Run the Excel verification checklist

Navigate to the Door Schedule report: `/project/[YOUR_PROJECT_ID]/reports/door-schedule`

**Door Schedule Excel:**

- [ ] **XLS-01 (bold colored header):** Open the downloaded `.xlsx` in Excel or Google Sheets. Row 1 has a dark navy background color and white bold text. The color is visibly dark, not absent or default gray.
- [ ] **XLS-02 (sensible column widths):** All column values are fully visible without truncation. Column widths vary by content — narrow columns for short values (e.g., "Qty"), wider for longer values (e.g., "Location"). No column is extremely wide (over ~50 characters wide).
- [ ] **XLS-03 (frozen header row):** Scroll down past row 1 in Excel. Row 1 (the header) remains visible at the top while data rows scroll underneath it.

Navigate to the Hardware Set report: `/project/[YOUR_PROJECT_ID]/reports/hardware-set`

**Hardware Set Excel:**

- [ ] **XLS-01, XLS-02, XLS-03:** Apply the same three checks above to the Hardware Set Excel download.

Navigate to the Pricing report: `/project/[YOUR_PROJECT_ID]/reports/pricing`

**Pricing Excel (check each sheet in the workbook):**

- [ ] **XLS-01 (header styled — Door Line Items sheet):** Row 1 of the "Door Line Items" sheet is dark navy with white bold text.
- [ ] **XLS-01 (header styled — Hardware Line Items sheet):** Same check on "Hardware Line Items" sheet.
- [ ] **XLS-01 (header styled — Cost Summary sheet):** Same check on "Cost Summary" sheet.
- [ ] **XLS-02 (column widths — all sheets):** No column in any pricing sheet truncates its data. "Description" columns are wider than "Qty" columns.
- [ ] **XLS-03 (frozen row — all sheets):** Row 1 is frozen on every sheet that has a column header row.

### Task 4: Run the ordering verification checklist

**ORD-01 and ORD-03 (Door Schedule PDF and Excel — custom sort preserved):**

1. In the Door Schedule UI at `/project/[YOUR_PROJECT_ID]/reports/door-schedule`, reorder the doors manually (drag rows or apply a grouping that changes the display order — use a custom sort if available).
2. Note the first 5 door tags in the UI display order.
3. Export PDF and note the first 5 door tags in the exported PDF. They must match the UI order exactly.
4. Export Excel and note the first 5 door tags. They must also match the UI order.

- [ ] **ORD-01 (Door Schedule PDF order matches UI):** First 5 door tags in the PDF match the UI display order.
- [ ] **ORD-01 (Door Schedule Excel order matches UI):** First 5 door tags in the Excel match the UI display order.
- [ ] **ORD-03 (custom sort preserved):** If you applied a custom grouping/sort in step 1, that order is reflected in both exports.

**ORD-02 (Hardware Set export order):**

1. Open the Hardware Set UI at `/project/[YOUR_PROJECT_ID]/reports/hardware-set`.
2. Note the order of hardware items displayed in the UI (e.g., "Hinges", "Locksets", "Closers" in that order).
3. Export Hardware Set PDF and verify the items appear in the same order.
4. Export Hardware Set Excel and verify the same order.

- [ ] **ORD-02 (Hardware Set PDF order matches UI):** Hardware items in the PDF match the UI display order.
- [ ] **ORD-02 (Hardware Set Excel order matches UI):** Hardware items in the Excel match the UI display order.

**ORD-04 (code review — order-preservation guards exist):**

Open each of the following files and confirm the explicit spread guards are present:
- [ ] `services/reportExportService.ts` — `exportDoorSchedule()` contains `const orderedDoors = [...doors]` with a comment referencing ORD-04.
- [ ] `services/reportExportService.ts` — `exportHardwareSet()` contains `const orderedDoors = [...doors]` and `const orderedHardwareSets = [...hardwareSets]`.
- [ ] `services/pricingReportService.ts` — `exportPricingReportToExcel()` contains `const orderedDoors = [...doors]` and `const orderedHardwareSets = [...hardwareSets]`.
- [ ] `components/doorSchedule/DoorScheduleConfig.tsx` — `handleDownload()` contains `const orderedDoors = [...includedDoors]`.

### Task 5: Regression check — confirm nothing is broken

- [ ] **Door Schedule export still works end-to-end:** No JavaScript console errors during PDF or Excel export from the Door Schedule page.
- [ ] **Hardware Set export still works end-to-end:** No console errors during PDF or Excel export from the Hardware Set page.
- [ ] **Pricing export still works end-to-end:** No console errors during Excel export from the Pricing page.
- [ ] **Elevation images in Door Schedule Excel:** Enable "Show Elevation Images" in the Door Schedule config (if your test project has elevation types). Export Excel. Elevation images appear in the sheet below the data table. The JSZip OOXML injection path is unaffected.
- [ ] **Submittal package is unaffected:** Navigate to `/project/[YOUR_PROJECT_ID]/reports/submittal-package`. The `react-to-print` flow still works. No errors.
- [ ] **TypeScript build is clean:** `npx tsc --noEmit` at project root reports zero errors.

---

## Verification

This plan IS the verification. All checklist items above must be marked complete.

**Summary of requirements verified:**

| Req ID | Description | Verified By |
|--------|-------------|-------------|
| PDF-01 | All PDFs share one visual template | Task 2 — side-by-side comparison |
| PDF-02 | Branded header on every page | Task 2 — header checks page 1 and page 2+ |
| PDF-03 | Footer with page numbers | Task 2 — footer checks |
| PDF-04 | Styled column header row | Task 2 — header row color check |
| PDF-05 | Alternating row shading | Task 2 — row shading check |
| PDF-06 | Column headers repeat on each page | Task 2 — multi-page header repeat check |
| PDF-07 | No rows cut off at page boundaries | Task 2 — page boundary inspection |
| XLS-01 | Bold colored Excel header row | Task 3 — header color check all sheets |
| XLS-02 | Content-appropriate column widths | Task 3 — width check all sheets |
| XLS-03 | Frozen header row | Task 3 — freeze pane check all sheets |
| ORD-01 | Door schedule export order matches UI | Task 4 — order comparison |
| ORD-02 | Hardware set export order matches UI | Task 4 — order comparison |
| ORD-03 | Custom sort reflected in export | Task 4 — custom sort verification |
| ORD-04 | Explicit order-preservation guards in code | Task 4 — code review |
| VER-01 | All verified across Door, Hardware, Pricing | Tasks 2, 3, 4 combined |
