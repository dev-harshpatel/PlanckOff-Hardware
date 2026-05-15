import { getRedisClient } from '@/lib/cache/redis';
import { getDoorScheduleImport } from '@/lib/db/hardware';
import type { DoorScheduleImport } from '@/lib/db/hardware';

/**
 * Door schedule cache wrapper (server-only).
 * Key:  door-schedule:{projectId}
 * TTL:  5 minutes (300s) — D-09 safety net; primary consistency is delete-on-write (D-08).
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

const TTL_SECONDS = 5 * 60;

function buildKey(projectId: string): string {
  return `door-schedule:${projectId}`;
}

/**
 * Cache-aside read. Returns the same shape as getDoorScheduleImport()
 * so the GET handler in app/api/projects/[id]/door-schedule/route.ts
 * can swap calls without changing destructuring or error handling.
 *
 * On Redis read error: logs and falls through to Supabase (fail-open, CACHE-05).
 * On Supabase error: returns the error as-is and does NOT populate cache.
 */
export async function getCachedDoorSchedule(
  projectId: string,
): Promise<DbResult<DoorScheduleImport | null>> {
  const key = buildKey(projectId);

  try {
    const redis = getRedisClient();
    const cached = await redis.get<DoorScheduleImport | null>(key);
    if (cached !== null && cached !== undefined) {
      return { data: cached, error: null };
    }
  } catch (err) {
    console.error(
      '[cache:door-schedule] Redis get failed — falling through to Supabase:',
      err,
    );
  }

  const result = await getDoorScheduleImport(projectId);

  if (!result.error) {
    try {
      const redis = getRedisClient();
      await redis.set(key, result.data, { ex: TTL_SECONDS });
    } catch (err) {
      console.error(
        '[cache:door-schedule] Redis set failed — cache not populated:',
        err,
      );
    }
  }

  return result;
}

/**
 * Deletes the door schedule cache key for a specific project.
 * Called after a successful upsertDoorScheduleImport() (POST and PATCH).
 * Redis failures are logged; the 5-minute TTL is the safety net.
 */
export async function invalidateDoorSchedule(projectId: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(buildKey(projectId));
  } catch (err) {
    console.error(
      '[cache:door-schedule] Redis del failed — cache key may be stale:',
      err,
    );
  }
}
