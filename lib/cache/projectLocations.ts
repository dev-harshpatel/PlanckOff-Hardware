import { unstable_cache, revalidateTag } from 'next/cache';
import { getProjectLocationOptions } from '@/lib/db/projectLocations';
import type { CountryOption } from '@/lib/project-locations';

/**
 * Project location options cache wrapper (server-only).
 *
 * Mechanism: Next.js `unstable_cache` from `next/cache`.
 * Tag:       'project-locations'
 * KeyParts:  ['project-locations-all']
 * TTL:       3600s — location reference data changes only when an admin
 *            edits the project_location_provinces table directly.
 *
 * The wrapped function never fails open unsafely — it falls back to the
 * hardcoded PROJECT_LOCATION_OPTIONS constant on DB error (CACHE-05 pattern).
 */
type DbResult<T> = { data: T | null; error: { message: string } | null };

export const getCachedProjectLocations = unstable_cache(
  async (): Promise<DbResult<CountryOption[]>> => getProjectLocationOptions(),
  ['project-locations-all'],
  { tags: ['project-locations'], revalidate: 3600 }
);

/**
 * Invalidates the project-locations cache. No write API exists today,
 * but exported for future use if a POST/PUT route is added.
 */
export function invalidateProjectLocations(): void {
  revalidateTag('project-locations');
}
