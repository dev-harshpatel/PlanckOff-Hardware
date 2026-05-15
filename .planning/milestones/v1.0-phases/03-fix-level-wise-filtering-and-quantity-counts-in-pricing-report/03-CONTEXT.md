# Phase 3: Fix Level-wise Filtering and Quantity Counts in Pricing Report - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** PRD Express Path (user ticket)

<domain>
## Phase Boundary

This phase delivers a focused fix to the Pricing Report's level-wise filtering logic and count calculation.

Specifically:
- The level-wise filter in `PricingReportConfig.tsx` and `usePricingFilters.ts` must correctly include/exclude items based on the selected level(s)
- The displayed "count" must be recalculated as `SUM(Total Qty)` for the filtered result, not `COUNT(rows)`
- Grouping logic in `pricingGrouping.ts` must correctly apply level filters before grouping
- Export (Excel/PDF) in `usePricingExport.ts` must use the same filtered dataset as the UI
- The detail modal in `PricingDetailModal.tsx` must reflect filtered quantities/totals consistently

Primary test case: **Mixed Use Kamloops** project must show correct data when filtering by individual levels.

</domain>

<decisions>
## Implementation Decisions

### Level-wise Filtering
- Level filter selections in the Pricing Report MUST return only hardware/pricing rows belonging to the selected level(s)
- Filtering logic lives in `hooks/usePricingFilters.ts` — fix the predicate that checks item level membership
- The filter must be applied BEFORE grouping in `utils/pricingGrouping.ts`
- Level filter must work correctly when multiple levels are selected (OR logic per level)

### Count Calculation
- Count shown in Pricing Report header/summary = `SUM(item.totalQty)` for all filtered rows
- Count must NOT be `filteredRows.length` or any row-count metric
- This applies to counts shown in: report header, filter badge, summary rows, and any group headers

### Grouped Pricing Data
- Level filter must be respected when data is grouped (by door, by hardware set, or by category)
- After applying level filter, grouping recalculates sub-totals and grand totals based on filtered items only
- No items from non-selected levels should appear in any group

### Export Consistency
- `usePricingExport.ts` must consume the same filtered+grouped dataset that the UI renders
- Export must NOT use the raw unfiltered dataset
- Both Excel and PDF exports affected

### Detail Modal Consistency
- `PricingDetailModal.tsx` must display quantities and totals that match the Pricing Report table
- If the report is filtered, the modal quantities must reflect the same filtered context

### Regression Guard
- All existing Pricing Report behavior WITHOUT filters must continue to work unchanged
- No filter = all items shown, count = sum of all Total Qty

### Claude's Discretion
- Exact implementation approach for propagating filtered state to exports and modal (prop drilling vs. context vs. shared hook return)
- Whether to refactor or minimally fix the existing filter predicate
- How to add/update tests for the corrected behavior

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pricing Report Core Files
- `src/components/pricing/PricingReportConfig.tsx` — Main config/filter UI component
- `src/hooks/usePricingFilters.ts` — Filter state and predicate logic
- `src/utils/pricingGrouping.ts` — Grouping logic applied to filtered data
- `src/hooks/usePricingExport.ts` — Export pipeline (Excel/PDF)
- `src/components/pricing/PricingDetailModal.tsx` — Detail modal showing quantities/totals

### Project Planning
- `.planning/REQUIREMENTS.md` — PRF-01–08 requirement definitions
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria

</canonical_refs>

<specifics>
## Specific Ideas

- **Reference project:** Mixed Use Kamloops — use this project to reproduce the bug and verify the fix
- **Bug reproduction steps (to document):**
  1. Open the Mixed Use Kamloops project
  2. Navigate to the Pricing Report
  3. Apply a level-wise filter (e.g., select "Level 1" only)
  4. Observe: incorrect items may appear, and the count shows row count instead of sum of Total Qty
- **Count field:** Look for wherever the "count" or "total items" badge/number is rendered in `PricingReportConfig.tsx` — it currently uses `.length` and should use `.reduce((sum, item) => sum + item.totalQty, 0)`
- **Filter predicate:** In `usePricingFilters.ts`, the level comparison may be checking the wrong field, using loose equality, or missing multi-level OR logic

</specifics>

<deferred>
## Deferred Ideas

- None — PRD covers phase scope

</deferred>

---

*Phase: 03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report*
*Context gathered: 2026-05-07 via PRD Express Path*
