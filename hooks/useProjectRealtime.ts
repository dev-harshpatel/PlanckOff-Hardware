'use client';

import { useEffect, useRef } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface UseProjectRealtimeOptions {
  projectId: string;
  /** Called when door_schedule_imports changes for this project. */
  onDoorScheduleChange: () => void;
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
}: UseProjectRealtimeOptions) {
  const onDoorScheduleChangeRef = useRef(onDoorScheduleChange);
  onDoorScheduleChangeRef.current = onDoorScheduleChange;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
