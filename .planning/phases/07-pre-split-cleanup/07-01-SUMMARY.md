---
phase: 07-pre-split-cleanup
plan: 01
subsystem: infra
tags: [typescript, tsc, baseline, pre-split]

# Dependency graph
requires: []
provides:
  - ".planning/tsc-baseline.txt — 142-line tsc --noEmit snapshot captured before any v2.0 source modification"
affects: [07-02, 07-03, 08, 09, 10, 11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "tsc-baseline diff pattern: subsequent plans run tsc --noEmit and diff against .planning/tsc-baseline.txt to prove zero new errors"

key-files:
  created:
    - ".planning/tsc-baseline.txt"
  modified: []

key-decisions:
  - "142 pre-existing tsc errors captured in baseline (not zero) — errors span app/, components/, hooks/, utils/ — all pre-date this milestone"
  - "Baseline is stable: two consecutive tsc --noEmit runs produce identical 142-line output (diff confirmed IDENTICAL)"
  - ".planning/tsc-baseline.txt is gitignored (local planning artifact); not committed to source control"

patterns-established:
  - "Pre-split baseline pattern: capture tsc --noEmit before any file is modified; diff after each split to detect regressions"

requirements-completed: [PRE-04]

# Metrics
duration: 3min
completed: 2026-05-13
---

# Phase 7 Plan 01: TypeScript Compiler Baseline Capture Summary

**142-line tsc --noEmit snapshot saved to .planning/tsc-baseline.txt — stable baseline for zero-regression diffing across all Phase 7-11 splits**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-13T15:46:00Z
- **Completed:** 2026-05-13T15:49:00Z
- **Tasks:** 1 completed
- **Files modified:** 1 (.planning/tsc-baseline.txt — gitignored, not in VCS)

## Accomplishments

- Ran `npx tsc --noEmit` from project root `/f/PlanckOff-Hardware` and captured full output
- Confirmed 142 pre-existing errors (exit code 1 / 2 on re-run — both non-zero as expected)
- Verified baseline stability: two consecutive runs produce byte-identical output (diff IDENTICAL)
- Baseline saved to `.planning/tsc-baseline.txt` before any source file in Phase 7 was touched

## Task Commits

Since `.planning/` is gitignored (per project decision), the baseline file is a local planning artifact:

1. **Task 1: Capture tsc --noEmit baseline** — `.planning/tsc-baseline.txt` written (local artifact, not committed to git)

**Plan metadata committed with SUMMARY + STATE updates.**

## Files Created/Modified

- `.planning/tsc-baseline.txt` — Full tsc --noEmit output, 142 lines, 20094 bytes. Covers errors in: app/api/team/invite/route.ts, app/project/.../pricing/page.tsx, components/doorSchedule/DoorScheduleConfig.tsx, components/hardware/ElectrificationEditor.tsx, hooks/useDoorTableState.tsx, utils/doorValidation.ts, utils/hardwareDataMigration.ts, utils/reportGenerator.ts, utils/xlsxParser.ts, and others.

## Decisions Made

- 142 pre-existing tsc errors confirmed — all pre-date v2.0; not introduced by this plan
- Baseline is stable across consecutive runs (tested twice, output identical)
- .planning/tsc-baseline.txt is local only (gitignored) — consistent with `.planning/ kept local (not committed to git)` project decision

## Deviations from Plan

None — plan executed exactly as written.

The `2>&1 > file` redirect in bash silently discarded stderr output. Used `> file 2>&1` instead, then copied from /tmp. Functionally identical result.

## Known Stubs

None — this plan only captures a file snapshot; no UI or data stubs.

## Self-Check: PASSED

- `.planning/tsc-baseline.txt` exists: FOUND
- Line count: 142 (> 0) PASS
- Stability: two runs produce identical output PASS
- Written before any source file was modified: PASS (no source files touched in this plan)
