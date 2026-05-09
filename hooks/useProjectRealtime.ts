'use client';

import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** Generic shape for a postgres_changes payload row. Each table refines this in plans 04-05/04-06. */
type AnyRow = Record<string, unknown>;

interface UseProjectRealtimeOptions {
  projectId: string;
  /** door_schedule_imports — kept as a fire-and-reload callback (existing behaviour). */
  onDoorScheduleChange: () => void;
  /** project_hardware_finals — payload contains final_json blob. Wired in plan 04-05. */
  onHardwareFinalsChange?: (payload: RealtimePostgresChangesPayload<AnyRow>) => void;
  /** project_pricing_items — wired in plan 04-06. */
  onPricingItemsChange?: (payload: RealtimePostgresChangesPayload<AnyRow>) => void;
  /** project_pricing_proposal — wired in plan 04-06. */
  onPricingProposalChange?: (payload: RealtimePostgresChangesPayload<AnyRow>) => void;
  /** projects (filtered to id=eq.{projectId}) — wired in plan 04-06. */
  onProjectChange?: (payload: RealtimePostgresChangesPayload<AnyRow>) => void;
  /** Fired after the channel reconnects (SUBSCRIBED again after a prior CLOSED). Plan 04-06 wires this to a full data reload. */
  onFullReload?: () => void;
}

/**
 * Subscribes to Supabase Realtime Postgres Changes for the project's tables.
 *
 * door_schedule_imports    → fires onDoorScheduleChange
 * project_hardware_finals  → fires onHardwareFinalsChange (wired in plan 04-05)
 * project_pricing_items    → fires onPricingItemsChange (wired in plan 04-06)
 * project_pricing_proposal → fires onPricingProposalChange (wired in plan 04-06)
 * projects                 → fires onProjectChange (wired in plan 04-06)
 *
 * All callbacks are held in refs so the subscriptions are never recreated
 * when the caller's function reference changes between renders.
 *
 * On reconnect (SUBSCRIBED after a prior CLOSED), fires onFullReload for
 * silent recovery from network drops (D-09).
 */
export function useProjectRealtime({
  projectId,
  onDoorScheduleChange,
  onHardwareFinalsChange,
  onPricingItemsChange,
  onPricingProposalChange,
  onProjectChange,
  onFullReload,
}: UseProjectRealtimeOptions) {
  const onDoorScheduleChangeRef    = useRef(onDoorScheduleChange);
  const onHardwareFinalsChangeRef  = useRef(onHardwareFinalsChange);
  const onPricingItemsChangeRef    = useRef(onPricingItemsChange);
  const onPricingProposalChangeRef = useRef(onPricingProposalChange);
  const onProjectChangeRef         = useRef(onProjectChange);
  const onFullReloadRef            = useRef(onFullReload);

  onDoorScheduleChangeRef.current    = onDoorScheduleChange;
  onHardwareFinalsChangeRef.current  = onHardwareFinalsChange;
  onPricingItemsChangeRef.current    = onPricingItemsChange;
  onPricingProposalChangeRef.current = onPricingProposalChange;
  onProjectChangeRef.current         = onProjectChange;
  onFullReloadRef.current            = onFullReload;

  const wasClosedRef = useRef(false);

  useEffect(() => {
    if (!projectId) return;

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`project-realtime-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'door_schedule_imports', filter: `project_id=eq.${projectId}` },
        () => { onDoorScheduleChangeRef.current(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_hardware_finals', filter: `project_id=eq.${projectId}` },
        (payload) => { onHardwareFinalsChangeRef.current?.(payload as RealtimePostgresChangesPayload<AnyRow>); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_pricing_items', filter: `project_id=eq.${projectId}` },
        (payload) => { onPricingItemsChangeRef.current?.(payload as RealtimePostgresChangesPayload<AnyRow>); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'project_pricing_proposal', filter: `project_id=eq.${projectId}` },
        (payload) => { onPricingProposalChangeRef.current?.(payload as RealtimePostgresChangesPayload<AnyRow>); },
      )
      .on(
        'postgres_changes',
        // NOTE: projects table PK is `id` (not `project_id`) — see RESEARCH.md "Pitfall 5".
        { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
        (payload) => { onProjectChangeRef.current?.(payload as RealtimePostgresChangesPayload<AnyRow>); },
      )
      .subscribe((status, err) => {
        if (status === 'CLOSED') {
          wasClosedRef.current = true;
        }
        if (status === 'SUBSCRIBED' && wasClosedRef.current) {
          wasClosedRef.current = false;
          onFullReloadRef.current?.();
        }
        if (err) {
          console.error('[useProjectRealtime] subscription error:', err);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
