# Phase 3: Fix Level-wise Filtering and Quantity Counts in Pricing Report - Research

**Researched:** 2026-05-07
**Domain:** Pricing Report filtering pipeline (hooks, utils, export, modal)
**Confidence:** HIGH — all findings sourced directly from codebase, verified by code reading

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Level filter selections MUST return only hardware/pricing rows belonging to the selected level(s)
- Filtering logic lives in `hooks/usePricingFilters.ts` — fix the predicate that checks item level membership
- The filter MUST be applied BEFORE grouping in `utils/pricingGrouping.ts`
- Level filter must work correctly when multiple levels are selected (OR logic per level)
- Count = `SUM(item.totalQty)` for all filtered rows, NOT `filteredRows.length`
- Count applies to: report header, filter badge, summary rows, and group headers
- Level filter must be respected when data is grouped (by door, by hardware set, or by category)
- After applying level filter, grouping recalculates sub-totals and grand totals based on filtered items only
- No items from non-selected levels should appear in any group
- `usePricingExport.ts` must consume the same filtered+grouped dataset that the UI renders — NOT the raw unfiltered dataset
- Both Excel and PDF exports affected
- `PricingDetailModal.tsx` must display quantities and totals matching the Pricing Report table
- If the report is filtered, modal quantities must reflect the same filtered context
- All existing Pricing Report behavior WITHOUT filters must continue to work unchanged

### Claude's Discretion

- Exact implementation approach for propagating filtered state to exports and modal (prop drilling vs. context vs. shared hook return)
- Whether to refactor or minimally fix the existing filter predicate
- How to add/update tests for the corrected behavior

### Deferred Ideas (OUT OF SCOPE)

- None — PRD covers phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRF-01 | Level-wise filter selections return only rows belonging to selected level(s) | Bug root cause identified in `hardwareTransformers.ts:169` and `xlsxParser.ts:73` — `buildingArea` field never forwarded to `buildingLocation` |
| PRF-02 | Count equals SUM of Total Qty, not number of visible rows | Bug at `usePricingFilters.ts:221-222` — `g.doors.length` used instead of `g.totalQty` |
| PRF-03 | Mixed Use Kamloops shows correct level-wise filtered data with accurate counts | Depends on PRF-01 fix; Kamloops uses "BUILDINGN AREA" column with values "LEVEL 01" / "LEVEL 02" |
| PRF-04 | Total Qty values accurate after applying level filters | Follows from PRF-01 fix — filtering gates group inclusion |
| PRF-05 | Pricing totals accurate after applying level filters | Follows from PRF-01 fix — `calcTotal` sums `totalPrice` per visible group |
| PRF-06 | Exported Excel/PDF matches filtered UI result exactly | Bug at `PricingReportConfig.tsx:169-174` — `doorGroups`/`frameGroups` passed to export instead of `visibleDoors`/`visibleFrames` |
| PRF-07 | Detail modal quantities/totals match main table after filtering | `modalGroup` is set directly from `visibleDoors`/`visibleFrames`/`visibleHardware` on row click — already uses filtered data. No code change required if PRF-01 is fixed. |
| PRF-08 | Existing behavior without filters continues to work (no regression) | All three fixes are additive — zero-filter state passes all filter predicates unchanged |

</phase_requirements>

---

## Summary

The Pricing Report has three distinct bugs that together produce incorrect level-wise filtering and wrong counts. All three are mechanical code defects, not design problems. The data flow for level/floor values is broken at the ingest boundary: the Excel column "BUILDINGN AREA" (which encodes level data like "LEVEL 01") is correctly mapped to `buildingArea` by the server-side parser but is never forwarded to `Door.buildingLocation` by `hardwareTransformers.ts`, so `buildingLocation` is always `undefined`. The filter UI reads `buildingLocation ?? location`, finds nothing, and populates zero options — making the "Building Location" filter appear empty or non-functional for the Mixed Use Kamloops project.

The count bug is independent and simpler: `totalDoorCount` and `totalFrameCount` sum `g.doors.length` (number of Door records in the group, ignoring each door's `quantity`) instead of `g.totalQty` (the pre-computed sum that already accounts for quantities). The hardware tab already uses `g.totalQty` correctly.

The export bug is a wrong-variable reference: `PricingReportConfig.tsx` calls `usePricingExport` with `doorGroups` and `frameGroups` (the unfiltered lists) while the UI renders `visibleDoors` and `visibleFrames` (the filtered lists).

**Primary recommendation:** Fix three lines across four files. The changes are surgical and minimal.

---

## Architecture Patterns

### Data Flow (level filtering)

```
Excel upload (client or server)
  └─ doorScheduleService.ts  (server)  → DoorScheduleRow.buildingArea  = "LEVEL 01"
  └─ xlsxParser.ts           (client)  → Door.buildingLocation         = undefined  ← BUG A
       └─ hardwareTransformers.ts      → Door.buildingLocation = row.buildingLocation  ← BUG B
                                                               (never reads row.buildingArea)
                └─ usePricingFilters.ts
                    └─ pricingGrouping.ts  groupByFields()
                        reads: door.buildingLocation ?? door.location
                        → group.floors[] populated from buildingLocation
                    └─ filterDoorGroups()  checks filters.floor against group.floors
                    → visibleDoors (filtered)
                    → visibleHardware (filtered)
                └─ usePricingExport (called with doorGroups NOT visibleDoors)  ← BUG C
```

### Filtering Internals

The filter field named "Building Location" in the UI (`label="Building Location"`) maps to the internal key `floor` in the `Filters` interface and `filters.floor[]`. This controls filtering by the `group.floors[]` array on each `DoorPricingGroup`.

The `floors` array on a group is built during `groupByFields()` in `pricingGrouping.ts`:

```typescript
// pricingGrouping.ts:231-232
const floor = (door.buildingLocation ?? door.location ?? '').trim();
if (floor && !group.floors.includes(floor)) group.floors.push(floor);
```

If `door.buildingLocation` and `door.location` are both empty/undefined, `group.floors` stays `[]`, and `uniqueValues(doorGroups, 'floors')` returns `[]`, so no filter options are shown in the UI.

### Count Calculation Internals

The count displayed on each tab badge comes from:

```typescript
// usePricingFilters.ts:221-223
const totalDoorCount  = useMemo(() => visibleDoors.reduce((s, g) => s + g.doors.length, 0),  [visibleDoors]);
const totalFrameCount = useMemo(() => visibleFrames.reduce((s, g) => s + g.doors.length, 0), [visibleFrames]);
const totalHwCount    = useMemo(() => visibleHardware.reduce((s, g) => s + g.totalQty, 0),   [visibleHardware]);
```

Hardware already uses `g.totalQty`. Doors and frames use `g.doors.length` — the number of Door records — ignoring the `quantity` field on each door.

### Export Data Source

`PricingReportConfig.tsx` calls `usePricingExport` at lines 168–198. The relevant arguments:

```typescript
// PricingReportConfig.tsx:168-174
const { handleDownloadExcel, handleDownloadPdf, handleDownloadProposalPdf } = usePricingExport({
  ...
  doorGroups,        // ← BUG: should be visibleDoors
  frameGroups,       // ← BUG: should be visibleFrames
  hardwareGroups: visibleHardware,   // ← correct
  doorTotal,         // ← derived from visibleDoors, so would be correct after fix
  frameTotal,        // ← derived from visibleFrames, so would be correct after fix
  ...
});
```

`usePricingExport.ts` iterates `doorGroups` and `frameGroups` directly to build Excel rows and PDF body arrays. It does not re-filter.

### Detail Modal Data Flow

`PricingDetailModal` is opened by `setModalGroup(g)` where `g` comes from iterating `visibleDoors`, `visibleFrames`, or `visibleHardware` in the table body (lines 742-749 of `PricingReportConfig.tsx`). The modal renders `group.doors` (the Door records that belong to that specific group). This is already correct — the modal shows exactly the doors in the clicked group. No fix required for PRF-07, but it depends on PRF-01: if the level filter is broken, the groups themselves are wrong, so the modal displays wrong data indirectly.

---

## Current Behavior (Bugs)

### Bug A — `xlsxParser.ts`: "BUILDINGN AREA" not recognized as `buildingLocation`

**File:** `utils/xlsxParser.ts`
**Line:** 73

```typescript
buildingLocation: ['buildinglocation', 'building location', 'bldg location', 'bldglocation'],
```

The alias list does not include `'buildingn area'` (or its normalized form `buildingnarea`). When a client-side Excel upload contains the "BUILDINGN AREA" column (present in Mixed Use Kamloops), `normalizeHeader('BUILDINGN AREA')` → `'buildingnarea'` — no match. The value is silently dropped. `Door.buildingLocation` is `undefined`.

### Bug B — `hardwareTransformers.ts`: `buildingArea` not forwarded to `buildingLocation`

**File:** `utils/hardwareTransformers.ts`
**Line:** 169

```typescript
buildingLocation: bi?.['BUILDING LOCATION'] ?? d?.['BUILDING LOCATION'] ?? row.buildingLocation,
```

The server-side parse path stores the level value in `DoorScheduleRow.buildingArea` (via `doorScheduleService.ts` line 28: `'buildingn area': 'buildingArea'`). But `transformDoors()` only reads `row.buildingLocation`, never `row.buildingArea`. So `Door.buildingLocation` is always `undefined` for projects that used "BUILDINGN AREA" in the source spreadsheet.

### Bug C — `PricingReportConfig.tsx`: export receives unfiltered data

**File:** `components/pricing/PricingReportConfig.tsx`
**Lines:** 169-174

```typescript
doorGroups,        // raw unfiltered groups
frameGroups,       // raw unfiltered groups
hardwareGroups: visibleHardware,  // filtered (correct)
```

Exports use all door/frame groups regardless of any active filter.

### Bug D — `usePricingFilters.ts`: count uses row count instead of Total Qty

**File:** `hooks/usePricingFilters.ts`
**Lines:** 221-222

```typescript
const totalDoorCount  = useMemo(() => visibleDoors.reduce((s, g) => s + g.doors.length, 0),  [visibleDoors]);
const totalFrameCount = useMemo(() => visibleFrames.reduce((s, g) => s + g.doors.length, 0), [visibleFrames]);
```

`g.doors.length` counts the number of Door records in the group. If a door has `quantity: 3`, it is still counted as 1. The correct value is `g.totalQty`, which is pre-computed in `groupByFields()` by summing `getDoorQty(door)` for each door.

---

## Steps to Reproduce (Mixed Use Kamloops)

1. Open the Mixed Use Kamloops project.
2. Navigate to the Pricing Report tab.
3. Observe the "Building Location" filter dropdown — it shows no options (empty dropdown or "All" only), because `Door.buildingLocation` is `undefined` for all doors.
4. Even if some doors have `buildingLocation` set via a different upload path, applying the filter will return incorrect results because the export (step 6) ignores the filter.
5. Observe the count badge on the "Doors" tab — it shows the number of Door records in the group set, not the sum of their `quantity` fields. For Kamloops with 4 Level-01 rows (all qty=1) and 41 Level-02 rows (all qty=1) this happens to match, but projects with `quantity > 1` on any door will show a lower count than the actual Total Qty.
6. Export to Excel or PDF — the exported file contains all door groups (unfiltered) even if a filter is active in the UI.

---

## Root Cause Analysis

| # | Bug | Root Cause | Location |
|---|-----|------------|----------|
| A | Level filter has no options for Kamloops | "BUILDINGN AREA" column not in alias list | `xlsxParser.ts:73` |
| B | Level filter has no options (server parse path) | `buildingArea` field not forwarded to `buildingLocation` in transformer | `hardwareTransformers.ts:169` |
| C | Export ignores active filter | `doorGroups`/`frameGroups` passed instead of `visibleDoors`/`visibleFrames` | `PricingReportConfig.tsx:169-170` |
| D | Count shows row count not Total Qty | `g.doors.length` used instead of `g.totalQty` | `usePricingFilters.ts:221-222` |

---

## Expected Behavior After Fix

1. "Building Location" filter dropdown for Mixed Use Kamloops shows "LEVEL 01" and "LEVEL 02" as options.
2. Selecting "LEVEL 01" shows only the 4 doors on Level 01; the count badge shows 4 (sum of Total Qty).
3. Selecting "LEVEL 02" shows only the 41 doors on Level 02; the count badge shows 41.
4. Exporting with a level filter active produces an Excel/PDF containing only the filtered groups.
5. The count badge on any tab (with no filter) equals the sum of all `totalQty` values, which matches the "Total Qty" column sum visible in the table.
6. The detail modal shows the same doors as the table row it was opened from (already correct once the filter works).

---

## Fix Strategy

### Fix 1 — `utils/xlsxParser.ts` line 73 (Bug A)

Add `'buildingn area'` and `'buildingarea'` to the `buildingLocation` alias list:

```typescript
buildingLocation: [
  'buildinglocation', 'building location', 'bldg location', 'bldglocation',
  'buildingn area', 'buildingarea', 'building area',  // ← add these
],
```

**Why:** The normalizer strips non-alphanumeric characters, so `'buildingn area'` normalizes to `'buildingnarea'`. Adding the alias before normalization ensures the mapping fires. Both the typo variant (`'buildingn area'`) and the correct spelling (`'building area'`) should be covered.

**Risk:** Zero. Adding aliases only expands matching — no existing mapped column is displaced.

### Fix 2 — `utils/hardwareTransformers.ts` line 169 (Bug B)

Change the `buildingLocation` assignment to fall back to `row.buildingArea`:

```typescript
// Before:
buildingLocation: bi?.['BUILDING LOCATION'] ?? d?.['BUILDING LOCATION'] ?? row.buildingLocation,

// After:
buildingLocation: bi?.['BUILDING LOCATION'] ?? d?.['BUILDING LOCATION'] ?? row.buildingLocation ?? row.buildingArea,
```

**Why:** `doorScheduleService.ts` correctly stores the level/area value in `DoorScheduleRow.buildingArea`. When `buildingLocation` is absent (as it is for all "BUILDINGN AREA" source files), the transformer should fall back to `buildingArea`. The `??` chain ensures no existing `buildingLocation` value is overwritten.

**Risk:** Zero for projects that already have `buildingLocation`. For projects with `buildingArea` only, doors now gain a `buildingLocation` value, which enables the filter to work.

### Fix 3 — `components/pricing/PricingReportConfig.tsx` lines 169-170 (Bug C)

Pass `visibleDoors` and `visibleFrames` instead of `doorGroups` and `frameGroups`:

```typescript
// Before:
doorGroups,
frameGroups,

// After:
doorGroups: visibleDoors,
frameGroups: visibleFrames,
```

**Why:** `usePricingExport` iterates these arrays directly to build the export rows. The filter must be applied before hand-off. `doorTotal` and `frameTotal` are already derived from `visibleDoors`/`visibleFrames` respectively, so totals remain consistent.

**Risk:** Low. The only behavioral change is that exports now match the UI. With no filters active, `visibleDoors === doorGroups` (same content), so no-filter exports are unchanged.

**Note on `usePricingExport` interface:** The parameter is already typed as `DoorPricingGroup[]`, so passing `visibleDoors` (same type) requires no signature change.

### Fix 4 — `hooks/usePricingFilters.ts` lines 221-222 (Bug D)

Change `g.doors.length` to `g.totalQty`:

```typescript
// Before:
const totalDoorCount  = useMemo(() => visibleDoors.reduce((s, g) => s + g.doors.length, 0),  [visibleDoors]);
const totalFrameCount = useMemo(() => visibleFrames.reduce((s, g) => s + g.doors.length, 0), [visibleFrames]);

// After:
const totalDoorCount  = useMemo(() => visibleDoors.reduce((s, g) => s + g.totalQty, 0),  [visibleDoors]);
const totalFrameCount = useMemo(() => visibleFrames.reduce((s, g) => s + g.totalQty, 0), [visibleFrames]);
```

**Why:** `DoorPricingGroup.totalQty` is pre-computed in `groupByFields()` as the sum of `getDoorQty(door)` for each door. `g.doors.length` is the count of Door records, which ignores the `quantity` field. Hardware already uses `g.totalQty` on line 223.

**Risk:** Zero. `totalQty` is the semantically correct field. The only visible change is the count badge number on the Doors and Frames tabs when any door has `quantity > 1`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-alias header matching | Custom column name resolver | Extend existing `headerMappings` alias list in `xlsxParser.ts` | The normalizer+alias pattern already handles case/punctuation |
| Filtered export | New export hook | Pass `visibleDoors`/`visibleFrames` to existing `usePricingExport` | Export hook is data-agnostic; just feed it the right arrays |
| Qty sum | Custom accumulator | Use `g.totalQty` (already computed) | `groupByFields()` maintains `totalQty` incrementally during grouping |

---

## Common Pitfalls

### Pitfall 1: Alias normalizer strips hyphens and spaces
**What goes wrong:** Adding `'buildingn-area'` to the alias list won't match because normalizeHeader strips hyphens. The normalized form is `'buildingnarea'`.
**How to avoid:** Add the alias in its natural form (lowercase with spaces). The normalizer converts both the alias and the file header the same way, so `normalizeHeader('buildingn area') === normalizeHeader('buildingn area')` → true.

### Pitfall 2: `doorGroups` vs `visibleDoors` naming confusion
**What goes wrong:** `PricingReportConfig.tsx` destructures `doorGroups` from `usePricingFilters` (the full unfiltered set) AND `visibleDoors` (the filtered set). It's easy to mistake them.
**How to avoid:** Fix 3 only changes the arguments to `usePricingExport`. The `doorGroups` variable continues to exist and is still needed for the Proposal tab tables and `proposalDoorBase` calculations (which are intentionally unfiltered).

### Pitfall 3: `buildingArea` already present for some records, `buildingLocation` for others
**What goes wrong:** After Fix 2, some Door records have `buildingLocation` from `row.buildingLocation` and others have it from `row.buildingArea`. Both should produce the same filter behavior.
**How to avoid:** The `??` fallback chain guarantees: if `row.buildingLocation` is truthy, it wins. If it's undefined/null/empty, `row.buildingArea` is used. No data collision.

### Pitfall 4: `filterHardwareGroups` uses `doorFloors` not `floors`
**What goes wrong:** Hardware groups expose `doorFloors` (not `floors`) as the level array. The filter for hardware groups already reads `g.doorFloors` correctly in `filterHardwareGroups`. Do NOT change this.
**How to avoid:** Only touch `filterDoorGroups` if modifying filter predicates. `filterHardwareGroups` is already correct.

### Pitfall 5: Proposal tab uses unfiltered `doorGroups`/`frameGroups`
**What goes wrong:** The Proposal tab intentionally shows all groups (no filters). Fix 3 must only change the arguments to `usePricingExport`, not the Proposal tab's data source.
**How to avoid:** The Proposal tab's table body iterates `doorGroups` (line 421, 465 of `PricingReportConfig.tsx`) — these references are unaffected by Fix 3.

---

## Dependencies & Risks

### Cross-Cutting Concerns

| Concern | Detail | Risk |
|---------|--------|------|
| `doorGroups` used in Proposal tab | Lines 371, 418-434, 461-479 of `PricingReportConfig.tsx` iterate `doorGroups` for the Proposal door/frame tables. Fix 3 does NOT touch these. | Zero — Fix 3 only changes `usePricingExport` args |
| `proposalDoorBase`, `proposalFrameBase` | Computed from unfiltered `doorGroups`/`frameGroups` via `calcTotal`. These are intentionally unfiltered totals. | Zero — not changed |
| `hwSetList` | Computed from unfiltered `hardwareGroups` and all `doors`. Intentionally unfiltered for the HW Sets proposal view. | Zero — not changed |
| Export of `hardwareGroups` → already `visibleHardware` | Line 174 already passes `visibleHardware`. No change needed. | Zero |
| `PricingDetailModal` receives `modalGroup` | Set via `setModalGroup(g)` where `g` is from `visibleDoors`/`visibleFrames`/`visibleHardware`. Already correct. | Zero — no change needed |
| `sections.basic_information['BUILDING LOCATION']` | `hardwareTransformers.ts:169` reads `bi?.['BUILDING LOCATION']` first. Projects with a properly labeled "BUILDING LOCATION" column continue to work unchanged. | Zero |

### Regression Checklist

- [ ] No filter active: `visibleDoors === doorGroups` (same elements) — PRF-08 satisfied
- [ ] Filter active, Doors tab: `visibleDoors` subset of `doorGroups` — PRF-01 satisfied
- [ ] Count badge = sum(totalQty) on Doors/Frames — PRF-02 satisfied
- [ ] Export = filtered groups only — PRF-06 satisfied
- [ ] Proposal tab tables use `doorGroups` (unfiltered) — intentional, unchanged
- [ ] `proposalDoorBase` uses `doorGroups` (unfiltered) — intentional, unchanged

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure code changes with no external dependencies beyond the project's own TypeScript/React stack.

---

## Standard Stack

No new libraries required. All fixes operate on existing code.

| File | Change Type | Lines Affected |
|------|-------------|----------------|
| `utils/xlsxParser.ts` | Extend alias list | 1 line (add 2 aliases) |
| `utils/hardwareTransformers.ts` | Fallback chain extension | 1 line |
| `components/pricing/PricingReportConfig.tsx` | Argument rename | 2 lines |
| `hooks/usePricingFilters.ts` | Field access fix | 2 lines |

**Total changed lines: 6**

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no `jest.config.*`, `vitest.config.*`, or test directories found |
| Config file | None |
| Quick run command | Manual browser testing in the project |
| Full suite command | Manual verification against Mixed Use Kamloops dataset |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRF-01 | Level filter shows options and filters correctly | Manual | N/A | N/A |
| PRF-02 | Count badge = SUM(totalQty) | Manual | N/A | N/A |
| PRF-03 | Mixed Use Kamloops shows correct data | Manual | N/A | N/A |
| PRF-04 | Total Qty accurate after filter | Manual | N/A | N/A |
| PRF-05 | Pricing totals accurate after filter | Manual | N/A | N/A |
| PRF-06 | Export matches filtered UI | Manual | N/A | N/A |
| PRF-07 | Modal matches main table | Manual | N/A | N/A |
| PRF-08 | No regression without filter | Manual | N/A | N/A |

### Wave 0 Gaps

None — no test infrastructure to create. Manual verification is the gate:
1. Upload the `door_schedule_excel_sheet.json`-equivalent Excel file for Mixed Use Kamloops.
2. Open Pricing Report, check "Building Location" dropdown shows "LEVEL 01" and "LEVEL 02".
3. Select "LEVEL 01" — confirm count = 4, only 4 rows visible.
4. Export to Excel/PDF — confirm exported rows = 4.
5. Open a door row detail modal — confirm door tags match Level 01 doors.
6. Clear filter — confirm all rows return, count = total project qty.

---

## Open Questions

1. **Does Mixed Use Kamloops already exist as a saved project in Supabase, or must it be re-uploaded?**
   - What we know: The fix to `hardwareTransformers.ts` fixes data loaded from DB. The fix to `xlsxParser.ts` fixes fresh Excel uploads. If Kamloops is already persisted, the DB records will have `buildingArea: "LEVEL 01"` in `DoorScheduleRow` but `Door.buildingLocation: undefined` (from the transformer). After Fix B, the transformer will read `row.buildingArea` as fallback and populate `buildingLocation` correctly on next load.
   - What's unclear: Whether the persisted `final_json` stores `buildingLocation` or `buildingArea` — this determines whether a re-import is needed or if the fix is transparent.
   - Recommendation: Fix 2 handles the DB path. No re-import should be needed. But the implementer should test with a loaded project (not just a fresh upload) to confirm.

2. **Should `buildingArea` values be normalized before comparison (trim, uppercase)?**
   - What we know: The existing `floors` array population in `groupByFields()` trims with `.trim()`. The filter comparison uses `Array.includes()` which is exact-match. Values from the DB/parse are already trimmed strings.
   - What's unclear: Whether real-world data might have mixed-case level names (e.g., "Level 01" vs "LEVEL 01").
   - Recommendation: Apply `.trim()` only (already done). Case normalization is out of scope per deferred ideas.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading of `hooks/usePricingFilters.ts` (full file)
- Direct code reading of `utils/pricingGrouping.ts` (full file)
- Direct code reading of `hooks/usePricingExport.ts` (full file)
- Direct code reading of `components/pricing/PricingReportConfig.tsx` (full file)
- Direct code reading of `components/pricing/PricingDetailModal.tsx` (full file)
- Direct code reading of `services/doorScheduleService.ts` (full file)
- Direct code reading of `utils/hardwareTransformers.ts` (lines 128-220)
- Direct code reading of `utils/xlsxParser.ts` (lines 52-200)
- Direct code reading of `hooks/useProjectPersistence.ts` (lines 1-150)
- Data verification: `door_schedule_excel_sheet.json` — confirmed "BUILDINGN AREA" column with values "LEVEL 01" / "LEVEL 02"
- Alias normalization test: confirmed `normalizeHeader('BUILDINGN AREA')` → `'buildingnarea'` does not match any existing alias

### Secondary (MEDIUM confidence)
- `types.ts` — confirmed `Door` type has no dedicated `level` field; "level" is encoded in `buildingLocation`

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all four bugs confirmed by direct code + data inspection
- Fix strategy: HIGH — all fixes are one-line or two-line changes to well-understood code paths
- Regression risk: HIGH confidence it is low — fixes are additive, no shared state mutations

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable codebase, no active refactors on these files)
