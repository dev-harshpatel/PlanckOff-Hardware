import { Redis } from '@upstash/redis';

/**
 * Shared Upstash Redis client (server-only).
 *
 * - Initialized lazily on first call to getRedisClient() so Next.js build-time
 *   static analysis does not evaluate process.env before runtime env is loaded
 *   (see Phase 13 RESEARCH.md Pitfall 3).
 * - Mirrors the createSupabaseAdminClient() singleton pattern in
 *   lib/supabase/admin.ts for codebase consistency.
 * - NEVER import this file from client components, contexts, hooks, or
 *   anything under app/ that does not live in app/api/* — Redis client must
 *   not be exposed to the browser bundle (CACHE-04, D-07).
 */
let _redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (_redis !== null) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables.',
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}
