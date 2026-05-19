---
phase: 06-wire-export-and-realtime-error-handling
plan: 03
subsystem: hooks
tags: [error-handling, toast, persistence, save-failed, registry]
dependency_graph:
  requires: ["06-02"]
  provides: ["ERR-03 persistence path", "ERR-06 persistence path"]
  affects: ["hooks/useProjectPersistence.ts", "views/ProjectView.tsx"]
tech_stack:
  added: []
  patterns: ["registry-driven toast on catch", "required addToast parameter threading"]
key_files:
  created: []
  modified:
    - hooks/useProjectPersistence.ts
    - views/ProjectView.tsx
decisions:
  - "Actual caller of useProjectPersistence is views/ProjectView.tsx (not useProjectData.ts as the plan assumed) — addToast was threaded from ProjectView props instead"
  - "addToast is required (not optional) on UseProjectPersistenceOptions — prevents silent failures at any future call site"
metrics:
  duration: "~8 min"
  completed: "2026-05-12"
  tasks_completed: 2
  files_modified: 2
---

# Phase 6 Plan 3: Wire Save-Failure Toast in useProjectPersistence Summary

**One-liner:** Silent `console.warn` on save failures upgraded to `console.error` + `GENERAL_ERRORS.SAVE_FAILED` toast via required `addToast` parameter.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add addToast param + replace both console.warn catches | 1a2a133 | hooks/useProjectPersistence.ts |
| 2 | Pass addToast from actual caller into useProjectPersistence | 142162f | views/ProjectView.tsx |

## Changes Made

### hooks/useProjectPersistence.ts
- Added `import { GENERAL_ERRORS } from '@/constants/errors';`
- Added required `addToast: (toast: Omit<Toast, 'id'>) => void;` field to `UseProjectPersistenceOptions` interface
- Added `addToast` to the function's destructured parameters
- Replaced `saveToFinalJson` catch block: `console.warn` → `console.error` + `addToast({ type: 'error', message: GENERAL_ERRORS.SAVE_FAILED.message, details: GENERAL_ERRORS.SAVE_FAILED.action })`
- Replaced `saveToHardwarePdf` catch block: same pattern
- Updated both `useCallback` deps arrays from `[projectId]` to `[projectId, addToast]`

### views/ProjectView.tsx
- Added `addToast,` as the last property in the `useProjectPersistence({...})` call (line 62)
- `addToast` was already a prop of `ProjectView` — no new import or hook needed

## Verification Results

```
console.warn count in useProjectPersistence.ts: 0  (was 2)
GENERAL_ERRORS.SAVE_FAILED count:               4  (was 0, two .message + two .action)
addToast occurrences in useProjectPersistence:  6  (interface, destructure, 2 catch blocks, 2 deps arrays)
TypeScript errors in modified files:            0
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deviation] Call site is views/ProjectView.tsx, not hooks/useProjectData.ts**
- **Found during:** Task 1 pre-flight grep
- **Issue:** Plan assumed `useProjectPersistence` is called from `useProjectData.ts` (per RESEARCH.md File Map), but the actual call site in this codebase is `views/ProjectView.tsx`
- **Fix:** Task 2 updated `views/ProjectView.tsx` instead of `useProjectData.ts`. The plan explicitly covered this contingency: "If the call site is NOT in useProjectData.ts, identify the actual consumer file and update its call site there instead."
- **Files modified:** views/ProjectView.tsx
- **Commit:** 142162f

**Note on Plan 06-02 regression check:** The plan's Task 2 verification includes a check for `ERRORS.REALTIME.SUBSCRIPTION_FAILED` count = 2 in `useProjectData.ts`. That wiring is from Plan 06-02 which ran on a different branch/worktree — this worktree's `useProjectData.ts` does not contain that code. The check is N/A for this execution context; the plan's gap-closure objectives (ERR-03 and ERR-06 for the persistence path) are fully satisfied.

## Phase 6 Gap Closures Status

| Plan | Gap | Status |
|------|-----|--------|
| 06-01 | Export error handling (PDF_ERRORS.EXPORT_FAILED) | Complete |
| 06-02 | Realtime subscription error feedback (REALTIME_ERRORS) | Complete (other branch) |
| 06-03 | Persistence save failure feedback (GENERAL_ERRORS.SAVE_FAILED) | **Complete — this plan** |

All three Phase 6 gap closures are now addressed. ERR-03 (every failure point maps to a registry entry) and ERR-06 (all error surfaces use the registry exclusively) are satisfied for the persistence path.

## Known Stubs

None — both catch blocks use the registry copy directly.

## Self-Check: PASSED

- hooks/useProjectPersistence.ts modified: FOUND
- views/ProjectView.tsx modified: FOUND
- Commit 1a2a133 (Task 1): FOUND
- Commit 142162f (Task 2): FOUND
