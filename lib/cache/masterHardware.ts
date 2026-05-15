import { getRedisClient } from '@/lib/cache/redis';
import { getMasterHardwareItems } from '@/lib/db/masterHardware';
import type { MasterHardwareItem } from '@/lib/db/masterHardware';

/**
 * Master hardware catalog cache wrapper (server-only).
 * Key:  master-hardware:all
 * TTL:  60 minutes (3600s) — D-09; catalog rarely changes.
 *
 * Wraps ONLY the full-catalog read (getMasterHardwareItems). The paginated
 * read (getMasterHardwareItemsPaginated) is NOT cached — see RESEARCH.md
 * Pitfall 5 and Pattern 5. The API route handler keeps its branch check.
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

const CACHE_KEY = 'master-hardware:all';
const TTL_SECONDS = 60 * 60;

/**
 * Cache-aside read for the full master hardware catalog.
 * Same DbResult shape as getMasterHardwareItems().
 * Fail-open on Redis errors (CACHE-05).
 */
export async function getCachedMasterHardware(): Promise<DbResult<MasterHardwareItem[]>> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get<MasterHardwareItem[]>(CACHE_KEY);
    if (cached !== null && cached !== undefined) {
      return { data: cached, error: null };
    }
  } catch (err) {
    console.error(
      '[cache:master-hardware] Redis get failed — falling through to Supabase:',
      err,
    );
  }

  const result = await getMasterHardwareItems();

  if (!result.error) {
    try {
      const redis = getRedisClient();
      await redis.set(CACHE_KEY, result.data, { ex: TTL_SECONDS });
    } catch (err) {
      console.error(
        '[cache:master-hardware] Redis set failed — cache not populated:',
        err,
      );
    }
  }

  return result;
}

/**
 * Deletes the master hardware catalog cache key.
 * Called after a successful create/update/delete on master_hardware_items.
 */
export async function invalidateMasterHardware(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(CACHE_KEY);
  } catch (err) {
    console.error(
      '[cache:master-hardware] Redis del failed — cache key may be stale:',
      err,
    );
  }
}
