import { unstable_cache, revalidateTag } from 'next/cache';
import { getAllProjects } from '@/lib/db/projects';
import type { Project } from '@/types';

/**
 * Projects list cache wrapper (server-only).
 *
 * Mechanism: Next.js `unstable_cache` from `next/cache` (D-01).
 * Tag:       'projects' (D-11)
 * KeyParts:  ['projects-all'] (D-11) — no per-call differentiation; full-list snapshot.
 * TTL:       1800s = 30 minutes (D-09 revalidate option — fallback, not primary consistency).
 *
 * NEVER import this file from client components — `unstable_cache` is enforced
 * server-only by Next.js (CACHE-04).
 *
 * Note: In `next dev`, the Data Cache is disabled; every request hits Supabase.
 * Caching activates in `next build && next start` and on Vercel (RESEARCH Pitfall 2).
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

// In dev, bypass unstable_cache entirely so switching .env.local credentials
// takes effect immediately without needing to delete .next/cache.
export const getCachedProjects: () => Promise<DbResult<Project[]>> =
  process.env.NODE_ENV === 'development'
    ? getAllProjects
    : unstable_cache(
        async (): Promise<DbResult<Project[]>> => getAllProjects(),
        ['projects-all'],
        { tags: ['projects'], revalidate: 1800 },
      );

/**
 * Invalidates the projects-list cache. Called after successful project
 * create, soft-delete, hard-delete, or restore. Synchronous in Next.js 15;
 * existing call sites `await invalidateProjects()` work via harmless `await void`.
 */
export function invalidateProjects(): void {
  revalidateTag('projects');
}
