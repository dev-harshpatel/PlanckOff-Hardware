import { unstable_cache, revalidateTag } from 'next/cache';
import { getMasterHardwareItems } from '@/lib/db/masterHardware';
import type { MasterHardwareItem } from '@/lib/db/masterHardware';

/**
 * Master hardware catalog cache wrapper (server-only).
 *
 * Mechanism: Next.js `unstable_cache` from `next/cache` (D-01).
 * Tag:       'master-hardware' (D-11)
 * KeyParts:  ['master-hardware-all'] (D-11)
 * TTL:       3600s = 60 minutes (D-09 — catalog rarely changes).
 *
 * Wraps ONLY the full-catalog read (getMasterHardwareItems). The paginated
 * read (getMasterHardwareItemsPaginated) is NOT cached — the route handler
 * branches on `?export=true` and only the export branch hits this wrapper
 * (RESEARCH Pitfall 5; do not modify the route handler).
 *
 * NEVER import from client components — `unstable_cache` is enforced
 * server-only by Next.js (CACHE-04).
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

export const getCachedMasterHardware = unstable_cache(
  async (): Promise<DbResult<MasterHardwareItem[]>> => getMasterHardwareItems(),
  ['master-hardware-all'],
  { tags: ['master-hardware'], revalidate: 3600 }
);

/**
 * Invalidates the master-hardware catalog cache. Called after successful
 * create/update/delete on master_hardware_items.
 */
export function invalidateMasterHardware(): void {
  revalidateTag('master-hardware');
}
