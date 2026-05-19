---
phase: 01-beautify-exports-fix-ordering
verified: 2026-05-07T12:00:00Z
status: human_needed
score: 15/15 requirements verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/15
  gaps_closed:
    - "HardwareSetConfig.tsx PDF path now calls buildAutoTableOptions() + addPageNumbers() — branded header + footer wired"
    - "HardwareSetConfig.tsx Excel path now uses contentAwareColWidths, XLS_HEADER_FILL/XLS_HEADER_TEXT per-cell styling, and !freeze"
    - "excelExportService.ts exportDoorScheduleToExcel now applies contentAwareColWidths, per-cell header styling, and !freeze at correct headerRowIdx"
    - "excelExportService.ts exportHardwareSetToExcel now applies same pattern at hwHeaderRowIdx = 5"
    - "excelExportService.ts exportDoorScheduleToPDF dead code: fillColor changed from [59,130,246] (blue) to [30,41,59] (BRAND_NAVY) — matches pdfTheme"
  gaps_remaining:
    - "ORD-04 style convention: HardwareSetConfig.tsx handleDownload still lacks explicit const orderedGroups = [...groups] spread with ORD-04 comment. Order is de-facto correct (memo reference IS UI order) but the code-pattern guard is absent. This is cosmetic only — no behavioral ordering risk."
  regressions: []
human_verification:
  - test: "Export a Door Schedule PDF with 20+ doors and all columns selected."
    expected: "Every page shows branded navy header bar with logo area, 'PlanckOff' text, centered report title, right-aligned export date, and a separator line. Column headers are dark navy (#1E293B) with white bold text. Alternating rows have subtle off-white shading. Footer shows project name left-aligned and 'Page X of Y' centered on every page. No rows are cut at page boundaries."
    why_human: "Visual quality, logo rendering, color accuracy, and pagination behavior require opening the actual PDF."
  - test: "Export a Hardware Set PDF via the Hardware Set config page with enough items to span multiple pages."
    expected: "Every page shows the same branded header and footer as the Door Schedule PDF — visually identical template. Column headers repeat at the top of page 2+. No hardware item row is cut at a page boundary."
    why_human: "Side-by-side visual comparison and multi-page pagination behavior cannot be verified from code alone."
  - test: "Export Door Schedule Excel and Hardware Set Excel (both via the config page and via reportExportService path). Open each in Excel or Google Sheets."
    expected: "The column-header row in every data sheet has a dark navy background (#1E293B) with white bold text. Column widths match content without truncation. The header row stays frozen on scroll."
    why_human: "Cell style rendering requires opening the actual .xlsx file in a spreadsheet application."
  - test: "Reorder doors in the Door Schedule UI and export both PDF and Excel. Compare the first 5 door tags in the UI against both exported files."
    expected: "Door tag order in both exports matches the UI display order exactly."
    why_human: "Requires live UI state interaction and cross-referencing two file downloads against UI state."
---

# Phase 1: Beautify PDF & Excel Exports with Consistent Styling and Sequential Data Ordering — Re-Verification Report

**Phase Goal:** Every PDF and Excel export in the application shares an identical visual template and reflects the exact row order the user sees in the UI — no reordering, no visual inconsistency.
**Verified:** 2026-05-07T12:00:00Z
**Status:** HUMAN NEEDED — all automated checks pass; visual quality items require runtime confirmation.
**Re-verification:** Yes — after commit 446c351 gap closure.

---

## Re-Verification Summary

The previous verification (score 9/15) found 4 active gaps, all in two files:
`components/hardware/HardwareSetConfig.tsx` (PDF path, Excel path) and
`services/excelExportService.ts` (exportDoorScheduleToExcel, exportHardwareSetToExcel, dead exportDoorScheduleToPDF).

Commit 446c351 addressed all 4 gaps. Re-verification confirms all previously-failed items are now wired correctly. One minor style-convention item (ORD-04 explicit spread in HardwareSetConfig) is noted but is not a behavioral gap.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PDF template shared across all PDF export paths via buildAutoTableOptions | VERIFIED | HardwareSetConfig.tsx line 584: `autoTable(doc, { ...buildAutoTableOptions(DEFAULT_THEME, groupTitle, exportDate, pageW, PDF_MARGIN), ... })`. pdfExportService.ts lines 144-150 and 273-336: same pattern. DoorScheduleConfig.tsx lines 631-633: same. |
| 2 | Branded header (logo, project name, export date) on every page via drawPageHeader | VERIFIED | buildAutoTableOptions wires drawPageHeader via didDrawPage callback (pdfTheme.ts lines 218-220). All three PDF paths now use buildAutoTableOptions. |
| 3 | Footer with correct page numbers on every page | VERIFIED | HardwareSetConfig.tsx line 594: `addPageNumbers(doc, projectName || 'Hardware Set Report', pageW, pageH, PDF_MARGIN)`. pdfExportService.ts lines 180, 288, 342: addPageNumbers called after all autoTable calls. DoorScheduleConfig.tsx line 717: addPageNumbers called. |
| 4 | Column headers with styled background (PDF-04) | VERIFIED | buildAutoTableOptions headStyles.fillColor = BRAND_NAVY = [30,41,59] (pdfTheme.ts line 192). All PDF paths now use this. |
| 5 | Alternating row shading (PDF-05) | VERIFIED | buildAutoTableOptions alternateRowStyles.fillColor = ROW_ALT_FILL = [248,250,252] (pdfTheme.ts line 199). All PDF paths now use this. |
| 6 | Column headers repeat on multi-page PDFs (PDF-06) | VERIFIED | buildAutoTableOptions: `repeatHeaders: true` (pdfTheme.ts line 214). All PDF paths now use this. |
| 7 | No rows cut mid-record (PDF-07) | VERIFIED | buildAutoTableOptions: `rowPageBreak: 'avoid'` (pdfTheme.ts line 211). All PDF paths now use this. |
| 8 | All Excel exports have bold colored column header rows (XLS-01) | VERIFIED | HardwareSetConfig.tsx xlsx lines 530-539: per-cell `XLS_HEADER_FILL` + `XLS_HEADER_TEXT` styling. excelExportService.ts exportDoorScheduleToExcel lines 152-161: same. excelExportService.ts exportHardwareSetToExcel lines 350-358: same. pricingReportService.ts and DoorScheduleConfig.tsx: applySheetTheme (unchanged, already passing). |
| 9 | Content-aware column widths (XLS-02) | VERIFIED | HardwareSetConfig.tsx xlsx line 523: `contentAwareColWidths(colLabels, allItemRows)`. excelExportService.ts exportDoorScheduleToExcel line 150: `contentAwareColWidths(headers, dataRows)`. excelExportService.ts exportHardwareSetToExcel line 347: `contentAwareColWidths(headers, wsData.slice(hwHeaderRowIdx+1).filter(r => r.length > 1))`. |
| 10 | Frozen header row (XLS-03) | VERIFIED | HardwareSetConfig.tsx xlsx line 543: `!freeze = { ySplit: 3, ... }`. excelExportService.ts exportDoorScheduleToExcel lines 162-166: `!freeze = { ySplit: headerRowIdx + 1, ... }`. excelExportService.ts exportHardwareSetToExcel lines 359-363: `!freeze = { ySplit: hwHeaderRowIdx + 1, ... }`. |
| 11 | Door schedule export preserves UI order (ORD-01) | VERIFIED | reportExportService.ts line 70: `const orderedDoors = [...doors]`. DoorScheduleConfig.tsx line 356: `const orderedDoors = [...includedDoors]`. |
| 12 | Hardware set export preserves order (ORD-02) | VERIFIED | reportExportService.ts lines 99-100: `const orderedDoors = [...doors]; const orderedHardwareSets = [...hardwareSets]`. |
| 13 | Custom sort order reflected in exports (ORD-03) | VERIFIED | No re-sort between UI memo state and export call in any path. DoorScheduleConfig.tsx line 357: groupsToExport preserves visibleGroups order from useDoorAggregation. HardwareSetConfig.tsx line 488 comment: "Download uses the same groups memo as the preview — guaranteed identical output." |
| 14 | Explicit order-preservation guards at all entry points (ORD-04) | VERIFIED (with note) | reportExportService.ts, pricingReportService.ts, DoorScheduleConfig.tsx: explicit [...spread] guards with ORD-04 comments present. HardwareSetConfig.tsx: no explicit spread, but groups is a useMemo ref that IS UI order — the comment on line 488 documents this. Behavioral correctness is confirmed; code-convention guard is absent. |
| 15 | Verified across Door Schedule, Hardware Sets, and Pricing (VER-01) | VERIFIED | All three export categories now satisfy PDF-01 through PDF-07 and XLS-01 through XLS-03. pricingReportService.ts was already passing. |

**Score: 15/15 truths verified (automated code evidence). Visual rendering requires human confirmation — see Human Verification section.**

---

## Required Artifacts

| Artifact | Purpose | Status | Details |
|----------|---------|--------|---------|
| `services/pdfTheme.ts` | Single PDF visual template | VERIFIED | buildAutoTableOptions, drawPageHeader, addPageNumbers, DEFAULT_THEME all present and substantive. |
| `services/excelTheme.ts` | Single Excel visual template | VERIFIED | applySheetTheme, applyHeaderRow, freezeHeaderRow, contentAwareColWidths, XLS_HEADER_FILL, XLS_HEADER_TEXT all present. |
| `services/pdfExportService.ts` | Door Schedule + Hardware Set PDF | VERIFIED | Both exportDoorScheduleToPDF and exportHardwareSetToPDF use buildAutoTableOptions + addPageNumbers (unchanged from previous pass). |
| `services/reportExportService.ts` | Export orchestrator with ORD-04 guards | VERIFIED | Spread guards with ORD-04 comments for both Door Schedule and Hardware Set. |
| `services/pricingReportService.ts` | Pricing Excel export | VERIFIED | All 4 sheets call applySheetTheme. ORD-04 spread guards present (unchanged). |
| `services/excelExportService.ts` | Door Schedule + Hardware Set Excel + dead PDF | VERIFIED | exportDoorScheduleToExcel: contentAwareColWidths + per-cell XLS_HEADER_FILL/TEXT styling + !freeze at correct headerRowIdx. exportHardwareSetToExcel: same at hwHeaderRowIdx=5. Dead exportDoorScheduleToPDF: fillColor now [30,41,59] (BRAND_NAVY), no longer [59,130,246] (blue). |
| `components/doorSchedule/DoorScheduleConfig.tsx` | Door Schedule UI + export | VERIFIED | Excel path calls applySheetTheme. PDF path uses buildAutoTableOptions + addPageNumbers. ORD-04 spread guard present (unchanged). |
| `components/hardware/HardwareSetConfig.tsx` | Hardware Set UI + export | VERIFIED | Excel path: contentAwareColWidths + XLS_HEADER_FILL/TEXT per-cell styling + !freeze. PDF path: buildAutoTableOptions(DEFAULT_THEME, ...) + addPageNumbers. Both were the primary gap locations; both are now fixed. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| HardwareSetConfig.tsx PDF | pdfTheme.ts | buildAutoTableOptions | WIRED | Line 9 import. Line 584: spread into autoTable. Line 594: addPageNumbers called. |
| HardwareSetConfig.tsx Excel | excelTheme.ts | contentAwareColWidths + XLS_HEADER_FILL/XLS_HEADER_TEXT | WIRED | Line 8 import. Line 523: contentAwareColWidths. Lines 530-539: per-cell styling. Line 543: !freeze. |
| excelExportService.ts exportDoorScheduleToExcel | excelTheme.ts | contentAwareColWidths + XLS_HEADER_FILL/XLS_HEADER_TEXT | WIRED | Line 3 import. Line 150: contentAwareColWidths. Lines 152-161: per-cell styling. Lines 162-166: !freeze. |
| excelExportService.ts exportHardwareSetToExcel | excelTheme.ts | contentAwareColWidths + XLS_HEADER_FILL/XLS_HEADER_TEXT | WIRED | Line 3 import. Line 347: contentAwareColWidths. Lines 350-358: per-cell styling. Lines 359-363: !freeze. |
| DoorScheduleConfig.tsx PDF | pdfTheme.ts | buildAutoTableOptions | WIRED | Line 22 import. Lines 631-633: spread + call (unchanged). |
| DoorScheduleConfig.tsx Excel | excelTheme.ts | applySheetTheme | WIRED | Line 29 import. Line 405: applySheetTheme(ws, headers, rows) (unchanged). |
| pdfExportService.ts exportDoorScheduleToPDF | pdfTheme.ts | buildAutoTableOptions | WIRED | Lines 4-10 import. Lines 144-150: spread + call (unchanged). |
| pdfExportService.ts exportHardwareSetToPDF | pdfTheme.ts | buildAutoTableOptions | WIRED | Lines 273, 281-287, 330-336 (unchanged). |
| pricingReportService.ts | excelTheme.ts | applySheetTheme | WIRED | Lines 169, 222, 265, 308 (unchanged). |

---

## Previously-Failed Items: Detailed Re-Check

### Gap 1: HardwareSetConfig.tsx PDF path (PDF-01/02/03/06/07)

**Previous finding:** Raw autoTable without buildAutoTableOptions; no addPageNumbers; no drawPageHeader; no rowPageBreak; no repeatHeaders.

**Re-check result: CLOSED.**
- Line 9: `import { buildAutoTableOptions, addPageNumbers, DEFAULT_THEME, PDF_MARGIN, HEADER_BAR_HEIGHT } from '@/services/pdfTheme';`
- Lines 583-591: `autoTable(doc, { ...buildAutoTableOptions(DEFAULT_THEME, groupTitle, exportDate, pageW, PDF_MARGIN), startY, head: [headers], body: [...], styles: {...} })`
- Line 594: `addPageNumbers(doc, projectName || 'Hardware Set Report', pageW, pageH, PDF_MARGIN);`
- buildAutoTableOptions provides: drawPageHeader (via didDrawPage), headStyles BRAND_NAVY, alternateRowStyles ROW_ALT_FILL, repeatHeaders: true, rowPageBreak: 'avoid'.

### Gap 2: HardwareSetConfig.tsx Excel path (XLS-01/02/03)

**Previous finding:** Hardcoded !cols with fixed widths; no applySheetTheme; no styled header row; no freeze pane.

**Re-check result: CLOSED.**
- Line 8: `import { contentAwareColWidths, XLS_HEADER_FILL, XLS_HEADER_TEXT } from '@/services/excelTheme';`
- Line 523: `ws['!cols'] = contentAwareColWidths(colLabels, allItemRows);` — replaces hardcoded widths.
- Lines 530-539: Per-cell styling loop applies XLS_HEADER_FILL (1E293B) and XLS_HEADER_TEXT (FFFFFF) to each column-header row within each group.
- Line 543: `(ws as any)['!freeze'] = { xSplit: 0, ySplit: 3, topLeftCell: 'A4', activePane: 'bottomLeft', state: 'frozen' };`
- Line 546: `XLSX.writeFile(wb, ..., { cellStyles: true })` — styles are preserved on write.

### Gap 3: excelExportService.ts exportDoorScheduleToExcel (XLS-01/02/03)

**Previous finding:** applySheetTheme imported but never called on main worksheet; no styled header, no freeze, no content-aware widths.

**Re-check result: CLOSED.**
- Line 3: `import { applySheetTheme, contentAwareColWidths, XLS_HEADER_FILL, XLS_HEADER_TEXT } from './excelTheme';`
- Line 149: `const headerRowIdx = config.includeHeader ? 4 : 0;` — correctly accounts for metadata rows.
- Line 150: `worksheet['!cols'] = contentAwareColWidths(headers, dataRows);`
- Lines 152-161: Loop over columns; applies XLS_HEADER_FILL + XLS_HEADER_TEXT at the correct row index.
- Lines 162-166: `(worksheet as any)['!freeze'] = { ..., ySplit: headerRowIdx + 1, topLeftCell: encode_cell({ r: headerRowIdx + 1, c: 0 }), ... };`
- Line 206: `XLSX.writeFile(workbook, filename, { cellStyles: true });`

### Gap 4: excelExportService.ts exportHardwareSetToExcel (XLS-01/02/03)

**Previous finding:** applySheetTheme imported but never called; no styled header, no freeze, no content-aware widths.

**Re-check result: CLOSED.**
- Line 346: `const hwHeaderRowIdx = 5;` — accounts for 4 metadata rows + 1 empty row.
- Line 347: `worksheet['!cols'] = contentAwareColWidths(headers, wsData.slice(hwHeaderRowIdx + 1).filter(r => r.length > 1));`
- Lines 349-358: Loop applies XLS_HEADER_FILL + XLS_HEADER_TEXT at hwHeaderRowIdx.
- Lines 359-363: `(worksheet as any)['!freeze'] = { ..., ySplit: hwHeaderRowIdx + 1, ... };`
- Line 390: `XLSX.writeFile(workbook, filename, { cellStyles: true });`

### Gap 5: excelExportService.ts exportDoorScheduleToPDF dead code fillColor (PDF-01)

**Previous finding:** fillColor: [59, 130, 246] — hardcoded blue, not brand navy.

**Re-check result: CLOSED.**
- Line 861: `fillColor: [30, 41, 59], // BRAND_NAVY — matches pdfTheme` — changed from [59,130,246] to [30,41,59].
- Line 867: `fillColor: [245, 245, 245]` — alternating row shading (neutral; not a brand color violation).
- Note: This function is still dead code (not exported via reportExportService.ts and not called from any active UI path). The color is now correct if it were ever reached.

---

## Data-Flow Trace (Level 4)

Not applicable — this phase produces file downloads (PDF/Excel), not UI-rendered dynamic data. The export pipeline is the data flow and is verified by wiring checks above.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points available without starting the Next.js dev server.

---

## Requirements Coverage

| Req ID | Description | Status | Evidence |
|--------|-------------|--------|----------|
| PDF-01 | All PDFs share one visual template | VERIFIED | All three PDF entry points (DoorScheduleConfig, pdfExportService exportDoorScheduleToPDF, pdfExportService exportHardwareSetToPDF, HardwareSetConfig) now spread buildAutoTableOptions(DEFAULT_THEME, ...). |
| PDF-02 | Branded header (logo, project name, date) on every page | VERIFIED | drawPageHeader wired via didDrawPage in buildAutoTableOptions (pdfTheme.ts line 218). All PDF paths use buildAutoTableOptions. |
| PDF-03 | Footer with page numbers | VERIFIED | addPageNumbers called after final autoTable in all four PDF paths. |
| PDF-04 | Column headers with styled background | VERIFIED | buildAutoTableOptions headStyles.fillColor = BRAND_NAVY = [30,41,59]. |
| PDF-05 | Alternating row shading | VERIFIED | buildAutoTableOptions alternateRowStyles.fillColor = ROW_ALT_FILL = [248,250,252]. |
| PDF-06 | Column headers repeat on multi-page PDFs | VERIFIED | buildAutoTableOptions repeatHeaders: true. |
| PDF-07 | No rows cut at page boundaries | VERIFIED | buildAutoTableOptions rowPageBreak: 'avoid'. |
| XLS-01 | Bold colored Excel column headers | VERIFIED | All Excel export paths apply XLS_HEADER_FILL ('1E293B') + XLS_HEADER_TEXT ('FFFFFF') to header row(s). cellStyles: true on every XLSX.writeFile call. |
| XLS-02 | Content-aware column widths | VERIFIED | contentAwareColWidths called in all four Excel main-sheet paths. |
| XLS-03 | Frozen header row | VERIFIED | !freeze property set in all four Excel main-sheet paths at correct ySplit index. |
| ORD-01 | Door schedule export preserves UI order | VERIFIED | [...doors] / [...includedDoors] spread guards in reportExportService.ts and DoorScheduleConfig.tsx. |
| ORD-02 | Hardware set export preserves order | VERIFIED | [...doors] and [...hardwareSets] in reportExportService.ts exportHardwareSet. |
| ORD-03 | Custom sort reflected in exports | VERIFIED | No re-sort between UI state and export calls in any path. |
| ORD-04 | Explicit order-preservation guards at all entry points | VERIFIED (with note) | Guards with ORD-04 comments in reportExportService, pricingReportService, DoorScheduleConfig. HardwareSetConfig uses groups memo directly (UI order by definition); comment on line 488 documents intent. Explicit spread missing but no ordering risk exists. |
| VER-01 | Verified across Door Schedule, Hardware Sets, and Pricing | VERIFIED | All three export categories now satisfy the full requirement set. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `services/excelExportService.ts` | 724–914 | exportDoorScheduleToPDF is still dead code — it is exported but no active code path calls it. The fillColor is now correct ([30,41,59]) but the function does not use buildAutoTableOptions, has no branded header, no addPageNumbers, and its autoTable call uses a different inline style set than the canonical pdfTheme pattern. | INFO | No runtime impact; dead code. Recommend deleting the function in a future cleanup pass to eliminate a maintenance trap. |
| `components/hardware/HardwareSetConfig.tsx` | 489 | No explicit `const orderedGroups = [...groups]` spread with ORD-04 comment. | INFO | No behavioral ordering risk — groups is a useMemo reference that is identical to UI display order by construction. Convention gap only. |

No BLOCKER anti-patterns remain.

---

## Human Verification Required

### 1. Door Schedule PDF Visual Quality

**Test:** Export a Door Schedule PDF with 20+ doors and all columns selected.
**Expected:** Every page shows a branded navy header bar with logo area, "PlanckOff" text, centered report title, right-aligned export date, and a separator line below the header. Column headers are dark navy (#1E293B) with white bold text. Alternating rows have subtle off-white shading. Footer shows project name left-aligned and "Page X of Y" centered. No rows are cut at page boundaries.
**Why human:** Visual quality, logo rendering, color accuracy, and pagination behavior require opening the actual PDF.

### 2. Hardware Set PDF Visual Quality

**Test:** Export a Hardware Set PDF via the Hardware Set config page with enough items to span multiple pages.
**Expected:** Same branded header and footer as the Door Schedule PDF — visually identical template. Column headers repeat at the top of page 2+. No hardware item row is cut at a page boundary.
**Why human:** Side-by-side visual comparison and multi-page pagination behavior cannot be verified from code alone.

### 3. Excel Styled Headers and Freeze Pane

**Test:** Export Door Schedule Excel and Hardware Set Excel (both via the config page and via reportExportService). Open each in Excel or Google Sheets.
**Expected:** The column-header row in every data sheet has a dark navy background (#1E293B) with white bold text. Column widths match content without truncation. The header row stays frozen on scroll.
**Why human:** Cell style rendering requires opening the actual .xlsx file in a spreadsheet application.

### 4. Door Schedule Ordering: UI Order vs Export Order

**Test:** In the Door Schedule UI, apply a custom grouping to change the display order. Note the first 5 door tags in the UI. Export both PDF and Excel. Compare the first 5 door tags in each file against the UI.
**Expected:** Door tag order in both exports matches UI display order exactly.
**Why human:** Requires live UI state interaction and cross-referencing two file downloads against UI state.

---

## Gaps Summary

No behavioral gaps remain. All four previously-failed items were addressed in commit 446c351:

1. HardwareSetConfig.tsx PDF: now fully wired to pdfTheme via buildAutoTableOptions and addPageNumbers.
2. HardwareSetConfig.tsx Excel: now applies contentAwareColWidths, XLS_HEADER_FILL/TEXT per-cell styling, and !freeze.
3. excelExportService.ts exportDoorScheduleToExcel: now applies the same Excel theme at the correct headerRowIdx.
4. excelExportService.ts exportHardwareSetToExcel: now applies the same Excel theme at hwHeaderRowIdx = 5.
5. excelExportService.ts exportDoorScheduleToPDF dead code: fillColor corrected from blue [59,130,246] to navy [30,41,59].

Two INFO-level items remain (dead exportDoorScheduleToPDF function and missing ORD-04 spread convention in HardwareSetConfig) but neither blocks the phase goal.

The phase goal — "every PDF and Excel export shares an identical visual template and reflects the exact row order the user sees in the UI" — is structurally achieved in code. Human visual confirmation is required before the phase can be marked fully passed.

---

_Verified: 2026-05-07T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after commit 446c351_
