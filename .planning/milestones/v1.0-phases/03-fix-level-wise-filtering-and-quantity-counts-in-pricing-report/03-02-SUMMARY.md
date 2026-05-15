---
phase: 03-fix-level-wise-filtering-and-quantity-counts-in-pricing-report
plan: "02"
subsystem: utils/hardwareTransformers
tags: [bug-fix, building-location, transformDoors, fallback-chain]
dependency_graph:
  requires: []
  provides: [Door.buildingLocation populated from row.buildingArea for server/DB load path]
  affects: [PRF-01 level filter, PRF-04 quantity counts, PRF-05 pricing totals]
tech_stack:
  added: []
  patterns: [nullish coalescing fallback chain]
key_files:
  created: []
  modified:
    - utils/hardwareTransformers.ts
decisions:
  - row.buildingArea added as final fallback after row.buildingLocation in the ?? chain (not before — priority preserved)
metrics:
  duration: "< 5 min"
  completed: "2026-05-13"
  tasks: 1
  files: 1
---

# Phase 03 Plan 02: Add buildingArea Fallback in transformDoors() Summary

**One-liner:** Extended `transformDoors()` buildingLocation fallback chain to include `row.buildingArea` as final fallback, enabling PRF-01 level filter for server/DB-loaded projects using the BUILDINGN AREA column.

## What Was Done

Task 1 applied a one-line fix to `utils/hardwareTransformers.ts` line 169. The `buildingLocation` assignment previously read:

```typescript
buildingLocation: bi?.['BUILDING LOCATION']   ?? d?.['BUILDING LOCATION']  ?? row.buildingLocation,
```

It now reads:

```typescript
buildingLocation: bi?.['BUILDING LOCATION']   ?? d?.['BUILDING LOCATION']  ?? row.buildingLocation ?? row.buildingArea,
```

The server-side parser (`services/doorScheduleService.ts`) maps the "BUILDINGN AREA" Excel column to `DoorScheduleRow.buildingArea`. Without this fallback, `buildingArea` values were silently dropped and `Door.buildingLocation` remained `undefined` for all server/DB-loaded projects that used the "BUILDINGN AREA" source column (e.g., Mixed Use Kamloops).

## Acceptance Criteria Verification

- `row.buildingArea` present on the buildingLocation line: PASS (grep confirmed)
- Priority order preserved (bi -> d -> row.buildingLocation -> row.buildingArea): PASS (automated check)
- `??` operator used (not `||`): PASS
- Exactly one line changed: PASS (git diff shows single hunk, single line)
- No new TypeScript errors: PASS (pre-existing errors unrelated to buildingLocation/buildingArea)
- `DoorScheduleRow.buildingArea` declared as `string | undefined` in `lib/db/hardware.ts` line 29: confirmed, no cast needed

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | cba3f0f | feat(03-02): add row.buildingArea as final fallback in buildingLocation assignment |

## Deviations from Plan

None — plan executed exactly as written. The fix was a single-character addition to line 169 matching the plan's action verbatim.

## Known Stubs

None.

## Self-Check: PASSED

- File `utils/hardwareTransformers.ts` modified: confirmed
- Commit cba3f0f exists: confirmed
- Verification script output: OK
