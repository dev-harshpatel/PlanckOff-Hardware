---
phase: 04-implement-real-time-ui-updates-via-supabase-realtime
plan: "07"
subsystem: hooks/state
tags: [optimistic-update, rollback, auto-save-suppression, doors, hardware-sets]
dependency_graph:
  requires: ["04-05", "04-06"]
  provides: ["optimistic-write primitive for door and hardware-set mutations"]
  affects: ["hooks/useProjectData.ts", "any component using useProjectData that performs inline door/hardware edits"]
tech_stack:
  added: []
  patterns: ["optimistic-update with snapshot rollback", "isInitialMount.current auto-save suppression", "useCallback with addToast ref capture"]
key_files:
  created:
    - hooks/useOptimisticDoorWrite.ts
  modified:
    - hooks/useProjectData.ts
decisions:
  - "Expose generic optimisticWrite (not convenience wrappers like optimisticUpdateDoors) to keep call sites self-documenting"
  - "No production write path changed — auto-save in useProjectPersistence.ts remains the default persistence loop"
metrics:
  duration: "~10 min"
  completed: "2026-05-10"
  tasks: 2
  files: 2
---

# Phase 04 Plan 07: useOptimisticDoorWrite Hook Summary

**One-liner:** Generic optimistic-write hook for doors and hardware sets with snapshot rollback, auto-save suppression, and error toast on failure.

---

## What Was Built

### hooks/useOptimisticDoorWrite.ts (new)

Exported signature:

```typescript
export interface OptimisticWriteOptions<T> {
  setter: Dispatch<SetStateAction<T>>;
  writer: () => Promise<void>;
  isInitialMount: MutableRefObject<boolean>;
  errorMessage?: string;
  errorDetails?: string;
}

export function useOptimisticDoorWrite(): <T>(
  next: T,
  prev: T,
  options: OptimisticWriteOptions<T>,
) => Promise<{ ok: boolean; error?: unknown }>;
```

### Exact rollback sequence (the catch block)

```typescript
} catch (error) {
  // Step 3b: rollback — suppress auto-save BEFORE the revert setState (Pitfall 3).
  isInitialMount.current = true;
  setter(prev);

  const message = errorMessage ?? ERRORS.GENERAL.SAVE_FAILED.message;
  const details = errorDetails ?? (error instanceof Error ? error.message : undefined);
  addToast({
    type: 'error',
    message,
    details,
  });
  return { ok: false, error };
}
```

The ordering is critical: `isInitialMount.current = true` BEFORE `setter(prev)` so the useEffect in `useProjectPersistence.ts` sees the flag set before the state change fires the debounce.

---

## Call Sites That Should Adopt This Hook (Future PRs, Not This Plan)

The following call sites would benefit from migrating to the optimistic pattern:

1. **Door tag inline edit** (`views/ProjectView.tsx` or similar) — when a user types a new door tag, apply optimistically; rollback if the server write fails.
2. **Hardware set drag-to-reorder** — drag a set to a new position; apply the reorder optimistically; rollback on failure.
3. **Hardware set rename** — inline rename input; apply the new name optimistically.
4. **Door-to-set assignment (drag-and-drop)** — reassigning a door to a different hardware set.

None of these are wired in this plan. This plan only provides the primitive.

---

## Production Write Path Unchanged

The existing auto-save loop in `useProjectPersistence.ts` (1-second debounce on `hardwareSets`, `doors`, `trashItems`) continues to be the production persistence mechanism. Adopting `optimisticWrite` at a call site is purely opt-in and additive — it provides immediate visual feedback while the auto-save handles the actual server write.

---

## Deviations from Plan

None — plan executed exactly as written. The worktree's `useProjectData.ts` was synced from the main repo (which had 04-05/04-06 changes) before adding the Task 2 changes, since this worktree pre-dated those plans.

---

## Known Stubs

None. The hook is fully wired — it calls `useToast`, uses `ERRORS.GENERAL.SAVE_FAILED`, and the rollback pattern is complete. No hardcoded empty values or placeholder text.

---

## Self-Check

- [x] `hooks/useOptimisticDoorWrite.ts` exists
- [x] `hooks/useProjectData.ts` contains `import { useOptimisticDoorWrite }` and returns `optimisticWrite`
- [x] Commit `4f05afb` — feat(04-07): create useOptimisticDoorWrite hook
- [x] Commit `07ca3f7` — feat(04-07): expose optimisticWrite from useProjectData return surface
- [x] `isInitialMount.current = true` appears on line 66, `setter(prev)` on line 67 (correct order)
- [x] No Supabase import in the hook
- [x] No `useProjectData` import in the hook
- [x] `addToast` called exactly once in catch block

## Self-Check: PASSED
