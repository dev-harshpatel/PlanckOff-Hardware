---
phase: 03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report
plan: "04"
subsystem: ui
tags: [react, hooks, useMemo, pricing, quantity]

requires:
  - phase: 03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report
    provides: usePricingFilters hook with DoorPricingGroup.totalQty precomputed by pricingGrouping.ts

provides:
  - totalDoorCount and totalFrameCount now sum g.totalQty (sum of door quantities) instead of g.doors.length (count of door records)
  - PRF-02 closed: count badges on Doors and Frames tabs display correct SUM(Total Qty)

affects:
  - components/pricing/PricingReportConfig.tsx (renders totalDoorCount/totalFrameCount as tab badges)

tech-stack:
  added: []
  patterns:
    - "All three count reductions (door, frame, hardware) now uniformly use g.totalQty — consistent pattern"

key-files:
  created: []
  modified:
    - hooks/usePricingFilters.ts

key-decisions:
  - "Column alignment preserved at position 97 — [visibleDoors], [visibleFrames], [visibleHardware] all open at same column after substituting g.totalQty for g.doors.length"

patterns-established:
  - "Count badge reductions in usePricingFilters always use g.totalQty, not g.doors.length"

requirements-completed:
  - PRF-02

duration: 5min
completed: 2026-05-13
---

# Phase 03 Plan 04: Fix totalDoorCount and totalFrameCount to Use g.totalQty Summary

**Two-line fix replacing g.doors.length with g.totalQty in totalDoorCount and totalFrameCount useMemo reductions, making Doors/Frames tab count badges display SUM(Total Qty) instead of row count**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T12:49:00Z
- **Completed:** 2026-05-13T12:54:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced `g.doors.length` with `g.totalQty` on the `totalDoorCount` useMemo line (line 221)
- Replaced `g.doors.length` with `g.totalQty` on the `totalFrameCount` useMemo line (line 222)
- Preserved columnar alignment — all three count lines (`totalDoorCount`, `totalFrameCount`, `totalHwCount`) now align the dependency array bracket `[` at column 97
- `totalHwCount` (line 223) left untouched — already used `g.totalQty` correctly
- Build succeeded with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace g.doors.length with g.totalQty in totalDoorCount and totalFrameCount** - `2018f64` (fix)

**Plan metadata:** (created with this summary)

## Files Created/Modified

- `hooks/usePricingFilters.ts` - Lines 221-222 changed from `g.doors.length` to `g.totalQty`; alignment at bracket position 97 maintained across all three count reduction lines

## Decisions Made

- Column alignment preserved at position 97 — spacing after `0),` increased by 4 spaces (door) and 4 spaces (frame) to compensate for `g.totalQty` being 3 chars shorter than `g.doors.length`, keeping the `[visible*]` bracket column-aligned with the unchanged hardware line

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The two-character-level substitutions were clean. The only nuance was computing the exact spacing needed to maintain column alignment with line 223 after the shorter `g.totalQty` identifier was substituted — resolved by measuring actual bracket positions with Node.js before committing.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Bug D (totalDoorCount/totalFrameCount using row count instead of quantity sum) is fully resolved
- PRF-02 requirement closed
- Count badges on Doors and Frames tabs in PricingReportConfig.tsx will now show correct totals for any dataset where doors have quantity > 1

---
*Phase: 03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report*
*Completed: 2026-05-13*
