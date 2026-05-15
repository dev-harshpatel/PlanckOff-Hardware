---
phase: 03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report
plan: "01"
subsystem: xlsxParser
tags: [bug-fix, xlsxParser, buildingLocation, alias, level-filter]
dependency_graph:
  requires: []
  provides: [buildingLocation-populated-from-BUILDINGN-AREA-column]
  affects: [utils/pricingGrouping.ts, pricing-filter-UI]
tech_stack:
  added: []
  patterns: [header-alias-normalization]
key_files:
  created: []
  modified:
    - utils/xlsxParser.ts
decisions:
  - "Three aliases added to buildingLocation: 'buildingn area', 'building area', 'buildingarea' — covers the Kamloops typo column and future corrected-spelling variants"
metrics:
  duration: "< 2 min"
  completed_date: "2026-05-13"
requirements:
  - PRF-01
  - PRF-03
---

# Phase 03 Plan 01: Fix buildingLocation Alias in xlsxParser Summary

## One-liner

Added `'buildingn area'`, `'building area'`, and `'buildingarea'` aliases to `buildingLocation` in `xlsxParser.ts` headerMappings so that the Mixed Use Kamloops Excel column "BUILDINGN AREA" correctly populates `door.buildingLocation`.

## What Was Done

### Task 1: Add 'buildingn area', 'building area', 'buildingarea' aliases for buildingLocation

**Status:** Complete (already committed in d4d66f6)

Line 73 of `utils/xlsxParser.ts` was updated from:

```typescript
buildingLocation:     ['buildinglocation', 'building location', 'bldg location', 'bldglocation'],
```

To:

```typescript
buildingLocation:     ['buildinglocation', 'building location', 'bldg location', 'bldglocation', 'buildingn area', 'building area', 'buildingarea'],
```

The change adds 3 new aliases:
1. `'buildingn area'` — exact typo column name from Mixed Use Kamloops source ("BUILDINGN AREA")
2. `'building area'` — corrected spelling for future Excel sheets  
3. `'buildingarea'` — already-normalized form (defensive; matches if header arrives pre-normalized)

All 4 original aliases were preserved verbatim.

**Commit:** d4d66f6 (part of `fix: pricing report level filter, qty counts, export filter, and Excel theme`)

**Verification result:**
```
node -e "...check all 7 aliases..." → OK
grep "'buildingn area'" utils/xlsxParser.ts → line 73 (match)
grep "'building area'" utils/xlsxParser.ts → line 73 (match)
grep "'buildingarea'" utils/xlsxParser.ts → line 73 (match)
git diff utils/xlsxParser.ts → no uncommitted changes
```

## Deviations from Plan

None — plan executed exactly as written. The fix was already applied in commit d4d66f6 prior to this agent's execution. All acceptance criteria verified passing.

## Known Stubs

None.

## Self-Check: PASSED

- File `utils/xlsxParser.ts` exists with 7-alias buildingLocation array on line 73: CONFIRMED
- Commit d4d66f6 contains the alias addition as a single-line diff: CONFIRMED
- All 7 aliases verified via automated node check: OK
- No new errors in xlsxParser.ts related to this change: CONFIRMED (pre-existing TS errors at line 273 are unrelated to the alias array)
