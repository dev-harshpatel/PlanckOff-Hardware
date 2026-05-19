'use client';

import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { ERRORS } from '@/constants/errors';

export interface OptimisticWriteOptions<T> {
  /** State setter that receives the optimistic next value (and the rollback prev value on failure). */
  setter: Dispatch<SetStateAction<T>>;
  /**
   * Executes the server write. Must resolve on success; reject (or throw) on failure.
   * On rejection, the hook rolls the setter back to `prev` and shows an error toast.
   */
  writer: () => Promise<void>;
  /**
   * Shared with useProjectPersistence — set true before rollback so the auto-save
   * effect short-circuits its next debounce cycle (see RESEARCH.md Pitfall 3).
   */
  isInitialMount: MutableRefObject<boolean>;
  /** Toast message override; defaults to ERRORS.GENERAL.SAVE_FAILED.message. */
  errorMessage?: string;
  /** Toast details override; defaults to error.message (if Error) or undefined. */
  errorDetails?: string;
}

/**
 * Generic optimistic-write hook for doors and hardware sets.
 *
 * Pattern (matches useDashboardState.ts handleProjectDropToStatus):
 *   1. Apply optimistic value via setter(next)
 *   2. Await writer()
 *   3a. On success — done. Return { ok: true }.
 *   3b. On failure — set isInitialMount.current = true (so the auto-save effect
 *       skips the next debounce), then setter(prev), then show an error toast.
 *       Return { ok: false, error }.
 *
 * Usage:
 *   const optimisticWrite = useOptimisticDoorWrite();
 *   await optimisticWrite(nextDoors, doorsRef.current, {
 *     setter: setDoors,
 *     writer: () => saveToFinalJson(hardwareSets, nextDoors, trashItems),
 *     isInitialMount,
 *   });
 */
export function useOptimisticDoorWrite() {
  const { addToast } = useToast();

  return useCallback(
    async <T,>(
      next: T,
      prev: T,
      options: OptimisticWriteOptions<T>,
    ): Promise<{ ok: boolean; error?: unknown }> => {
      const { setter, writer, isInitialMount, errorMessage, errorDetails } = options;

      // Step 1: optimistic apply.
      setter(next);

      try {
        // Step 2: server write.
        await writer();
        return { ok: true };
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
    },
    [addToast],
  );
}
