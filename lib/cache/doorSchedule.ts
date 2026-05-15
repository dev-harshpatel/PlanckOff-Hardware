import { unstable_cache, revalidateTag } from 'next/cache';
import { getDoorScheduleImport } from '@/lib/db/hardware';
import type { DoorScheduleImport } from '@/lib/db/hardware';

/**
 * Door schedule cache wrapper (server-only).
 *
 * Mechanism: Next.js `unstable_cache` from `next/cache` (D-01).
 * Tag:       'door-schedule' (D-11) — single tag for all projects (D-12).
 * KeyParts:  ['door-schedule'] PREFIX only — runtime `projectId` argument is
 *            automatically appended by `unstable_cache` to differentiate entries
 *            per project (RESEARCH Pattern 2 + Pitfall 1). DO NOT put projectId
 *            in `keyParts` — that captures a single id at module evaluation.
 * TTL:       300s = 5 minutes (D-09).
 *
 * Invalidation strategy (D-12): `revalidateTag('door-schedule')` clears ALL
 * project entries. Acceptable because any door-schedule write is project-scoped
 * and broad invalidation is safe + simpler than per-project key management.
 *
 * NEVER import from client components — `unstable_cache` is server-only (CACHE-04).
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

export const getCachedDoorSchedule = unstable_cache(
  async (projectId: string): Promise<DbResult<DoorScheduleImport | null>> =>
    getDoorScheduleImport(projectId),
  ['door-schedule'],
  { tags: ['door-schedule'], revalidate: 300 }
);

/**
 * Invalidates door schedule cache. Per D-12, the single 'door-schedule' tag
 * means this clears every project's cached entry — `projectId` is accepted to
 * match the existing call signature (await invalidateDoorSchedule(projectId))
 * but is not used in the body.
 */
export function invalidateDoorSchedule(_projectId: string): void {
  revalidateTag('door-schedule');
}
