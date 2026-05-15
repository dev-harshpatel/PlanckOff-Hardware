import { getRedisClient } from '@/lib/cache/redis';
import { getAllProjects } from '@/lib/db/projects';
import type { Project } from '@/types';

/**
 * Projects list cache wrapper (server-only).
 * Key:  projects:all
 * TTL:  30 minutes (1800s) — D-09; rebuilt on any create/delete/restore.
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

const CACHE_KEY = 'projects:all';
const TTL_SECONDS = 30 * 60;

/**
 * Cache-aside read for the active projects list.
 * Same DbResult shape as getAllProjects().
 * Fail-open on Redis errors (CACHE-05).
 */
export async function getCachedProjects(): Promise<DbResult<Project[]>> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get<Project[]>(CACHE_KEY);
    if (cached !== null && cached !== undefined) {
      return { data: cached, error: null };
    }
  } catch (err) {
    console.error(
      '[cache:projects] Redis get failed — falling through to Supabase:',
      err,
    );
  }

  const result = await getAllProjects();

  if (!result.error) {
    try {
      const redis = getRedisClient();
      await redis.set(CACHE_KEY, result.data, { ex: TTL_SECONDS });
    } catch (err) {
      console.error(
        '[cache:projects] Redis set failed — cache not populated:',
        err,
      );
    }
  }

  return result;
}

/**
 * Deletes the projects list cache key.
 * Called after successful project create, soft-delete, hard-delete, or restore.
 */
export async function invalidateProjects(): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(CACHE_KEY);
  } catch (err) {
    console.error(
      '[cache:projects] Redis del failed — cache key may be stale:',
      err,
    );
  }
}
