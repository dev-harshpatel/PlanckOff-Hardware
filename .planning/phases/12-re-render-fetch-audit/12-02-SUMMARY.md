---
phase: 12-re-render-fetch-audit
plan: 02
subsystem: views
tags: [performance, react-hooks, useMemo, useCallback, re-render-reduction]
dependency_graph:
  requires: []
  provides: [stable-callback-identities-in-ProjectView]
  affects: [views/ProjectView.tsx]
tech_stack:
  added: []
  patterns: [useMemo-for-derived-values, useCallback-for-prop-callbacks]
key_files:
  created: []
  modified:
    - views/ProjectView.tsx
decisions:
  - "useCallback on persistElevationTypes with [project.id] dep — avoids re-creation on unrelated project object changes"
  - "handleCancelHardwareTask and handleCancelDoorTask each depend on their respective useMemo task values — stable identity when processingTasks unchanged"
  - "formatElapsed has empty dep array — pure function with no closure dependencies"
metrics:
  duration: ~2.5 min
  completed: 2026-05-15
  tasks_completed: 2
  files_modified: 1
---

# Phase 12 Plan 02: Stable Callback Identities in ProjectView Summary

**One-liner:** `useMemo` on `hardwareActiveTask`/`doorActiveTask` and `useCallback` on six handlers in `views/ProjectView.tsx` — stops HardwareSetsManager and DoorScheduleManager from re-rendering on unrelated UI state changes.

## Files Modified

| File | Change |
|------|--------|
| `views/ProjectView.tsx` | Added `useCallback` to React import; wrapped 2 derived values in `useMemo`; wrapped 6 handlers in `useCallback` |

## Changes Applied

### Task 1: Memoize Active Tasks + Cancel Handlers

| Symbol | Hook | Dependency Array |
|--------|------|-----------------|
| `hardwareActiveTask` | `useMemo` | `[processingTasks]` |
| `doorActiveTask` | `useMemo` | `[processingTasks]` |
| `handleCancelHardwareTask` | `useCallback` | `[hardwareActiveTask, setProcessingTasks]` |
| `handleCancelDoorTask` | `useCallback` | `[doorActiveTask, setProcessingTasks]` |

Inline `onCancelTask` arrows in `hardwareSetsPanel` and `doorSchedulePanel` replaced with stable references:
- `onCancelTask={hardwareActiveTask ? handleCancelHardwareTask : undefined}`
- `onCancelTask={doorActiveTask ? handleCancelDoorTask : undefined}`

**Commit:** `1300db8`

### Task 2: Wrap Elevation + Format Handlers

| Symbol | Hook | Dependency Array |
|--------|------|-----------------|
| `persistElevationTypes` | `useCallback` | `[project.id]` |
| `handleElevationUpdate` | `useCallback` | `[project, onProjectUpdate, persistElevationTypes]` |
| `handleSingleElevationTypeUpdate` | `useCallback` | `[project, onProjectUpdate, persistElevationTypes]` |
| `formatElapsed` | `useCallback` | `[]` |

JSX props `onUpdate={handleElevationUpdate}` and `onElevationTypeUpdate={handleSingleElevationTypeUpdate}` already used bare references — no JSX edits required.

**Commit:** `5988d73`

## TypeScript Verification

`npx tsc --noEmit 2>&1 | grep -E "(TS2305|TS2307|TS2306|TS2322|TS2345)"` — all 27 matching errors are pre-existing in unrelated files (ElectrificationEditor, FinishSystemEditor, RevisionHistory, etc). Zero errors in `views/ProjectView.tsx`. Total tsc output: 133 lines vs baseline 142 (fewer, not more).

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified programmatically.

## Known Stubs

None.

## Self-Check: PASSED

- `views/ProjectView.tsx` modified: FOUND
- Commit `1300db8` (Task 1): FOUND
- Commit `5988d73` (Task 2): FOUND
- `useCallback` count 7 (>= 6): PASS
- `useMemo` count 4 (>= 3): PASS
- Zero inline cancel arrows: PASS
- Zero new tsc errors in ProjectView: PASS
