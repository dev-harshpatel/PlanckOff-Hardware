/**
 * Self-event deduplication for Supabase Realtime.
 *
 * Every write made by the current tab is marked here with a key of the form
 * `{table}:{id}:{updated_at}`. When a Realtime postgres_changes event arrives,
 * the receiving callback calls `isOwnWrite()` with the same key — if it
 * matches, the event is the echo of our own write and is skipped, preventing
 * double-updates.
 *
 * Per CONTEXT.md D-08:
 *   - Skip window: 2 seconds (typical Realtime round-trip)
 *   - Prune window: 5 seconds (upper bound; covers slow networks)
 *
 * We implement the 5s prune via setTimeout. Any event arriving inside that
 * window is treated as a self-event. The 2s figure is descriptive (typical
 * latency) — the 5s prune is the binding upper limit.
 */

const PRUNE_AFTER_MS = 5000;

const pendingWrites = new Set<string>();

function buildKey(table: string, id: string, updatedAtIso: string): string {
  return `${table}:${id}:${updatedAtIso}`;
}

/**
 * Mark a write as "made by this tab" so the corresponding Realtime echo can be skipped.
 * Auto-prunes after PRUNE_AFTER_MS ms.
 * @param table  Postgres table name (e.g. 'project_hardware_finals')
 * @param id     Row identifier — for projects/pricing_items use the row id; for project_pricing_proposal use project_id (the PK)
 * @param updatedAtIso  ISO timestamp returned by the API for this write (or new Date().toISOString() as a fallback)
 */
export function markPendingWrite(table: string, id: string, updatedAtIso: string): void {
  const key = buildKey(table, id, updatedAtIso);
  pendingWrites.add(key);
  setTimeout(() => {
    pendingWrites.delete(key);
  }, PRUNE_AFTER_MS);
}

/**
 * Returns true if the supplied {table,id,updatedAtIso} key was marked as a pending write
 * within the last 5 seconds (i.e. this is our own echo and should be skipped).
 */
export function isOwnWrite(table: string, id: string, updatedAtIso: string): boolean {
  return pendingWrites.has(buildKey(table, id, updatedAtIso));
}

/**
 * Test helper — clears the internal Set. Exported for unit tests / not for production use.
 */
export function __clearPendingWritesForTest(): void {
  pendingWrites.clear();
}
