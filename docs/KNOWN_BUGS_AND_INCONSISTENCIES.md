# Known Bugs & Inconsistencies

> Last updated: 2026-06-02
> Status: Identified, pending fixes

This document lists all known bugs found during a codebase audit. Each bug includes a plain-English explanation, how to manually test it before fixing, and where in the code it lives.

---

## How to read this document

Each bug has:
- **What's wrong** — simple explanation of the problem
- **How to test it** — step-by-step what to do in the app to see the bug
- **What you should see vs what you actually see**
- **Code location** — file and line number

---

## CRITICAL — Numbers are wrong

---

### BUG 1: Excluded doors still counted in hardware quantities

**What's wrong:**
When you mark a door as "Exclude" (from hardware), the system is supposed to ignore it when counting how many of each hardware item is needed. But in two places in the code, excluded doors are still being counted. So if you have 10 doors and exclude 3 of them, hardware quantities are calculated for 10 doors instead of 7.

**How to test it:**
1. Open any project that has hardware sets assigned to doors
2. Note the total hardware count shown on the Hardware tab in the Pricing Report (e.g., 200)
3. Go to the door schedule, find a door that belongs to a hardware set
4. Mark that door as `hardwareIncludeExclude = EXCLUDE`
5. Go back to the Pricing Report → Hardware tab
6. **Expected:** Hardware count should decrease (fewer doors = fewer hardware items needed)
7. **Actual:** Hardware count stays the same or changes incorrectly

**Code location:**
- `services/mergeService.ts` line ~354 — `doorCount` doesn't filter excluded doors
- `hooks/useProjectPersistence.ts` line ~87 — same issue

---

### BUG 2: Door quantity not factored into filtered hardware counts

**What's wrong:**
Some doors have a `quantity` field — meaning one door "record" actually represents multiple identical doors (e.g., quantity = 3 means 3 of the same door). When you filter hardware by floor/level, the code counts doors but ignores their quantity. So a single door record with quantity=3 gets counted as 1 door, not 3.

**How to test it:**
1. Open a project where some doors have `quantity > 1`
2. Go to Pricing Report → Hardware tab
3. Note the total hardware count with no filters applied
4. Now filter by a specific floor (e.g., Level 3)
5. **Expected:** The count should reflect actual door openings (door record × its quantity)
6. **Actual:** The count only reflects number of door records, ignoring the quantity field

**Simple example:**
- Floor 3 has 2 door records, each with quantity=5 → 10 actual openings
- Hardware item needs 1 unit per door
- Expected: 10 units shown when filtering Floor 3
- Actual: 2 units shown (only counting records, not quantities)

**Code location:**
- `utils/pricingGrouping.ts` line 339

---

### BUG 3: Excluded doors counted in hardware set usage stats

**What's wrong:**
In the Hardware Set view (where you see how many doors use each set), excluded doors are still being counted in the totals. So the "used in X doors" number is inflated.

**How to test it:**
1. Go to any project → Hardware Sets view
2. Note the door count shown for a specific hardware set (e.g., "Set A — used in 15 doors")
3. Go to the door schedule, find a door assigned to "Set A"
4. Mark it as excluded from hardware
5. Go back to the Hardware Sets view
6. **Expected:** Door count for "Set A" should drop by 1 (now 14 doors)
7. **Actual:** Count still shows 15

**Code location:**
- `components/hardware/HardwareSetConfig/index.tsx` line ~64

---

### BUG 4: Excel export service unreachable + column key mismatch

**What's wrong:**
There are actually two export systems in the code:
1. The **hardware set report page** builds its own Excel directly — this is what you see when you click Export on the Hardware Set Report page. It works fine.
2. A separate **`hardwareSetExcel.ts` service** exists and is supposed to be called via an `onExport` callback prop — but `HardwareSetConfig` never calls that prop. The service is effectively unreachable dead code.

On top of that, the dead service uses different column key names (`unitPrice`, `extendedPrice`) compared to every other part of the codebase (`unitCost`, `extendedCost`). And its "Cost Summary" sheet checks for key `extendedCost` but builds data from `item.unitCost` which may not exist — so even if it were reachable, the Total Cost would show $0.

**How to test it:**
> **You cannot test this from the Hardware Set report page UI** — the columns you see there (HW Set, Item Name, Qty/Set, Total, etc.) belong to the working export, not the broken one.

The broken service would only be triggered if something called `exportHardwareSet()` from `reportExportService.ts`. Currently nothing does this in a way that reaches the user.

**What to fix:**
Two separate things to address:
1. Remove `hardwareSetExcel.ts` entirely (dead code), OR wire up the `onExport` prop properly if it was intended to be used
2. If keeping the service, rename `unitPrice`/`extendedPrice` to `unitCost`/`extendedCost` to match the rest of the codebase

**Code location:**
- `services/excelExportService/hardwareSetExcel.ts` — the dead service
- `components/hardware/HardwareSetConfig/index.tsx` line ~35 — `onExport` prop defined but never called
- `services/reportExportService.ts` line ~119 — calls the dead service

---

### BUG 5: Excel multisheet export — wrong quantities for multi-lift doors

**What's wrong:**
Some doors have a `liftCount` value (e.g., a double-door counts as 2 lifts). When calculating hardware quantities, you're supposed to multiply by `liftCount`. The single-sheet export does this correctly, but the multi-sheet workbook export completely ignores `liftCount` — so any door with more than 1 lift will show half (or less) of the correct hardware quantity.

**How to test it:**
1. Find or create a project with doors that have `liftCount = 2`
2. Export using the regular (single-sheet) hardware export → note the quantities
3. Export using the multi-sheet workbook export → note the same quantities
4. **Expected:** Both exports should show the same quantities
5. **Actual:** Multi-sheet export shows lower quantities for multi-lift doors

**Code location:**
- `services/excelExportService/multiSheetWorkbook.ts` line ~156 and ~263

---

## HIGH — Wrong behavior in less common scenarios

---

### BUG 6: Door quantity edited in UI doesn't update hardware counts

**What's wrong:**
When a door's quantity is imported, it comes in and is saved in one field. When you edit it in the UI, it gets saved in a different field. When hardware quantities are recalculated, the code reads from the original import field and misses the updated UI value. So your edit has no effect on hardware counts.

**How to test it:**
1. Open any project and note the hardware count for a door's set
2. Find a door in the schedule and change its quantity (e.g., from 1 to 3)
3. Save the project
4. Go to Pricing Report → Hardware tab
5. **Expected:** Hardware counts should increase to reflect 2 extra doors
6. **Actual:** Hardware counts stay the same (reading old quantity)

**Code location:**
- `hooks/useProjectPersistence.ts` line ~88 — reads `sections.door.QUANTITY` but the UI writes to `sections.basic_information.QUANTITY`

---

### BUG 7: Hardware price breakdown hierarchy has wrong per-door math

**What's wrong:**
In the Proposal tab, hardware costs are broken down by material/floor/building. The math used to split the cost per door is incorrect — it multiplies the already-multiplied quantity again, causing the hierarchy breakdown numbers to not add up to the actual total.

**How to test it:**
1. Go to Pricing Report → Proposal tab
2. Apply a Material or Building filter to see the breakdown
3. Add up all the sub-items in the hardware breakdown
4. **Expected:** They should add up to the total hardware cost shown at the top
5. **Actual:** The sum of breakdown items does not match the total (will be off for any set with doors that have `quantity > 1`)

**Code location:**
- `hooks/usePricingFilters.ts` line ~84

---

## MEDIUM — Minor inaccuracies or UX issues

---

### BUG 8: Hardware set config uses wrong door quantity field

**What's wrong:**
Same as Bug 6 but in the Hardware Set config view. The door count shown for each set uses the old quantity field, not the one updated via the UI.

**How to test it:**
Same as Bug 6 — change a door's quantity in the UI, then check the door count shown in the Hardware Set configuration view.

**Code location:**
- `components/hardware/HardwareSetConfig/hardwareHelpers.ts` line ~114

---

### BUG 9: Price columns in hardware set Excel not recognized as numbers

**What's wrong:**
When exporting the hardware set to Excel, the Unit Price and Extended Price columns are written as plain text instead of numbers. This means Excel won't let you use SUM or other formulas on those columns — it just treats them as text.

**How to test it:**
1. Export any hardware set to Excel with Unit Price and Extended Price columns enabled
2. Open the Excel file
3. Click on a price cell (e.g., "14.99")
4. Try to SUM a range of price cells
5. **Expected:** SUM works and gives correct total
6. **Actual:** SUM returns 0 or shows a warning (cells are text, not numbers)
7. You can also check: the cell will be left-aligned in Excel if it's text; right-aligned if it's a number

**Code location:**
- `services/excelExportService/hardwareSetExcel.ts` lines ~59-62

---

### BUG 10: Excel export ignores active filters — exports everything

**What's wrong:**
If you have filters applied on the Pricing Report (e.g., showing only Level 3 hardware), and then export to Excel, the export ignores your filters and exports all data. Users naturally expect "export what I see."

**How to test it:**
1. Go to Pricing Report → Hardware tab
2. Apply a floor filter (e.g., Level 3 only) — note the count shown (e.g., 155 items)
3. Export to Excel (multisheet workbook)
4. Open the Excel file and count the hardware rows
5. **Expected:** Should have 155 items matching the filtered view
6. **Actual:** Has all items (e.g., 693) regardless of active filter

**Code location:**
- `services/excelExportService/multiSheetWorkbook.ts` lines ~133-140

---

## LOW — Edge cases

---

### BUG 11: Renaming a hardware set can orphan doors

**What's wrong:**
If a hardware set is renamed, doors that were assigned to it by the old name may lose their assignment and move to "Unassigned." This happens silently with no warning.

**How to test it:**
1. Note which doors are assigned to a specific hardware set (e.g., "Set A — 10 doors")
2. Rename the hardware set to "Set A Revised"
3. Check the door count for the renamed set
4. Check if any doors moved to "Unassigned"
5. **Expected:** All 10 doors should stay assigned under the new name
6. **Actual:** Some or all doors may appear in Unassigned

**Code location:**
- `hooks/useProjectPersistence.ts` line ~59

---

### BUG 12: Image column hardcoded in door schedule Excel export

**What's wrong:**
The door schedule Excel export assumes the image column is always column B (column index 1). If column order ever changes (due to a feature update), images will be placed in the wrong column with no error shown.

**How to test it:**
1. Export a door schedule to Excel with images
2. Verify images appear in the correct column
3. This is a latent risk — it won't appear broken today, but could break after code changes

**Code location:**
- `services/excelExportService/doorScheduleExcel.ts` line ~344

---

## Already Fixed

| Bug | Description | Fixed in |
|-----|-------------|----------|
| Pricing report floor filter showing inflated counts | `item.multipliedQuantity` (pre-baked total) was used even when filtering by floor, so Level 3 filter showed total-all-floors count instead of Level 3 only | `utils/pricingGrouping.ts` line 339 — 2026-06-02 |

---

## Priority Order for Fixing

| Priority | Bug | Why |
|----------|-----|-----|
| 1 | Bug 1 — Excluded doors in multipliedQuantity | Directly wrong hardware quantities |
| 2 | Bug 2 — Door quantity ignored in floor filter | Wrong filtered counts for multi-qty doors |
| 3 | Bug 3 — Excluded doors in usageStats | Wrong "used in X doors" display |
| 4 | Bug 4 — Excel total cost always $0 | Broken export feature |
| 5 | Bug 5 — liftCount missing in multisheet export | Wrong quantities in Excel |
| 6 | Bug 6 — UI quantity edit ignored | User edits have no effect |
| 7 | Bug 7 — Hierarchy price math | Proposal tab breakdown wrong |
| 8 | Bug 8 — Wrong qty field in set config | Minor display inaccuracy |
| 9 | Bug 9 — Prices as text in Excel | Excel formulas don't work on price columns |
| 10 | Bug 10 — Export ignores filters | UX expectation mismatch |
| 11 | Bug 11 — Rename orphans doors | Edge case data loss risk |
| 12 | Bug 12 — Hardcoded image column | Latent risk, not broken today |
