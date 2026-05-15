---
phase: 05-execute-pricing-report-fixes
plan: "01"
subsystem: pricing-report
status: complete
requirements-completed: [PRF-02, PRF-04, PRF-05, PRF-06]
requirements-partial: [PRF-01]
commit: 89e4a891dafa0726bdb19f60fbdc233f13e06339
tags: [pricing, filter, pdf-theme, qty-counts, per-door-filter]
dependency-graph:
  requires: []
  provides: [committed-pricing-filter-rewrite, per-door-filterDoorGroups, g.totalQty-counts, PDF-theme-alignment]
  affects: [05-02-PLAN.md, 05-03-PLAN.md]
tech-stack:
  added: []
  patterns: [per-door-filter-with-group-recompute, filteredDoorsForHw-hw-regrouping, Phase1-PDF-theme-in-export-hook]
key-files:
  created: []
  modified:
    - hooks/usePricingFilters.ts
    - utils/pricingGrouping.ts
    - hooks/usePricingExport.ts
decisions:
  - "Committed three uncommitted files atomically — no source edits, verification only"
  - "filterDoorGroups rewrite goes beyond Plan 03-04 spec — per-door filter with recomputed totals is the correct fix"
  - "Hardware filter replaced: filteredDoorsForHw + groupHardwareItems re-grouping supersedes old filterHardwareGroups predicate"
metrics:
  duration: "< 5 min"
  completed: "2026-05-12"
  tasks: 1
  files: 3
---

# Phase 05 Plan 01: Commit pricing filter rewrite — per-door filtering + qty-based counts + PDF theme

**One-liner:** Atomic commit of three uncommitted files implementing per-door filterDoorGroups rewrite, g.totalQty-based counts, hardware re-grouping via filteredDoorsForHw, and Phase 1 PDF theme alignment in usePricingExport.

## What was done

Committed three uncommitted files atomically. No source edits — only verification and commit:

- `hooks/usePricingFilters.ts`
- `utils/pricingGrouping.ts`
- `hooks/usePricingExport.ts`

Purpose: Establish a clean, committed baseline for Plan 05-02 (data source fix) and Plan 05-03 (verification).

## Pre-commit grep evidence

### Already-committed reference points (no edits needed)

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "'buildingn area'" utils/xlsxParser.ts` | 1 | 1 |
| `grep -c "'building area'" utils/xlsxParser.ts` | 1 | 1 |
| `grep -c "'buildingarea'" utils/xlsxParser.ts` | 1 | 1 |
| `grep -n "buildingLocation:" utils/hardwareTransformers.ts` (line 169) | contains `?? row.buildingArea` | CONFIRMED: `?? row.buildingLocation ?? row.buildingArea` |
| `grep -c "doorGroups: visibleDoors" components/pricing/PricingReportConfig.tsx` | 1 | 1 |
| `grep -c "frameGroups: visibleFrames" components/pricing/PricingReportConfig.tsx` | 1 | 1 |

### Working-tree state (committed in this plan)

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "g.totalQty" hooks/usePricingFilters.ts` | 3 | 3 |
| `grep -c "filterHardwareGroups" hooks/usePricingFilters.ts` | 0 | 0 |
| `grep -c "filteredDoorsForHw" hooks/usePricingFilters.ts` | >= 2 | 3 |
| `grep -c "groupHardwareItems(hardwareSets, filteredDoorsForHw)" hooks/usePricingFilters.ts` | 1 | 1 |
| `grep -c "noFilters" utils/pricingGrouping.ts` | >= 1 | 2 |
| `grep -c "matching.length === 0" utils/pricingGrouping.ts` | 1 | 1 |
| `grep -c "totalPrice: g.unitPrice * qty" utils/pricingGrouping.ts` | 1 | 1 |
| `grep -c "buildAutoTableOptions" hooks/usePricingExport.ts` | >= 1 | 4 |
| `grep -c "BRAND_NAVY" hooks/usePricingExport.ts` | >= 1 | 4 |
| `grep -c "addPageNumbers" hooks/usePricingExport.ts` | >= 1 | 2 |

All checks PASS. Proceeding to commit.

## Diff stats

```
 hooks/usePricingExport.ts  | 113 +++++++++++++++++++++++++++++++++++++-----------------------------------------------------
 hooks/usePricingFilters.ts |  32 ++++++++++++++++++++------
 utils/pricingGrouping.ts   |  41 ++++++++++++++++++++++++++++-----
 3 files changed, 106 insertions(+), 80 deletions(-)
```

## Build result

`npm run build`: PASS — `Compiled successfully in 9.7s`. Types validation skipped (next.config.ts `ignoreBuildErrors: true`). No new errors referencing `hooks/usePricingFilters.ts`, `utils/pricingGrouping.ts`, or `hooks/usePricingExport.ts`. All 24 static pages generated successfully.

## Commit hash

```
89e4a891dafa0726bdb19f60fbdc233f13e06339 feat(05-01): commit pricing filter rewrite — per-door filtering + qty-based counts + PDF theme
```

## Post-commit verification

- `git diff --name-only` for three files: empty (working tree clean)
- `git log -1 --name-only --format=""`: exactly `hooks/usePricingExport.ts`, `hooks/usePricingFilters.ts`, `utils/pricingGrouping.ts`
- `grep -c "g.totalQty" hooks/usePricingFilters.ts`: 3
- `grep -c "filterHardwareGroups" hooks/usePricingFilters.ts`: 0

## Requirement status after this commit

| Requirement | Status | Evidence |
|-------------|--------|----------|
| PRF-01 | PARTIAL | xlsxParser aliases (line 73) + hardwareTransformers transformDoors `?? row.buildingArea` (line 169) are in committed code. The `transformFromFinalJson` buildingLocation chain at hardwareTransformers.ts:309 still lacks `?? door.buildingArea` — addressed in 05-02. |
| PRF-02 | COMPLETE | `g.totalQty` used at lines 239-241 of usePricingFilters.ts (committed in this plan). |
| PRF-04 | COMPLETE | `filterDoorGroups` recomputes `totalQty` from matching per-door filter (committed in this plan). |
| PRF-05 | COMPLETE | `filterDoorGroups` recomputes `totalPrice = g.unitPrice * qty` (committed in this plan). |
| PRF-06 | COMPLETE (implementation) | `visibleDoors`/`visibleFrames` flow to usePricingExport from PricingReportConfig (already committed before this plan). Final verification deferred to Plan 05-03. |

## What this plan does NOT close

- PRF-03 (pricing page data source: transformFromFinalJson doors) — Plan 05-02
- PRF-07 / PRF-08 (manual verification) — Plan 05-03

## Deviations from Plan

None — plan executed exactly as written. No source file edits were needed; the working tree already contained the correct state as documented in 05-RESEARCH.md.

## Known Stubs

None. All committed code is complete implementation — no placeholder values, no TODO/FIXME markers in the three committed files.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `.planning/phases/05-execute-pricing-report-fixes/05-01-SUMMARY.md` exists | FOUND |
| Commit `89e4a89` exists in git history | FOUND |
| SUMMARY contains `g.totalQty` | FOUND (5 matches) |
| SUMMARY contains `commit:` | FOUND (2 matches) |
| SUMMARY contains `PRF-02`, `PRF-04`, `PRF-05`, `PRF-06` | FOUND (2 matches each) |
| Working tree clean for three target files | CONFIRMED (empty diff) |
| HEAD commit contains exactly 3 files | CONFIRMED |
