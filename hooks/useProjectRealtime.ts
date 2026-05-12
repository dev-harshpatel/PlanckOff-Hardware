'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface UseProjectRealtimeOptions {
  projectId: string;
  /** Called when door_schedule_imports changes for this project. */
  onDoorScheduleChange: () => void;
  /** Fired when the Supabase subscribe callback yields a non-null `err`. Plan 06-02 wires this to a toast. */
  onError?: (err: Error) => void;
}

/**
 * Subscribes to Supabase Realtime Postgres Changes for the project's tables.
 *
 * door_schedule_imports  → fires onDoorScheduleChange
 *
 * Both callbacks are held in refs so the subscriptions never need to be
 * recreated when the caller's function reference changes between renders.
 */
export function useProjectRealtime({
  projectId,
  onDoorScheduleChange,
  onError,
}: UseProjectRealtimeOptions) {
  const onDoorScheduleChangeRef = useRef(onDoorScheduleChange);
  onDoorScheduleChangeRef.current = onDoorScheduleChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!projectId) return;

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`project-realtime-${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'door_schedule_imports',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          onDoorScheduleChangeRef.current();
        },
      )
      .subscribe((_status, err) => {
        if (err) {
          console.error('[useProjectRealtime] subscription error:', err);
          onErrorRef.current?.(err as Error);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
