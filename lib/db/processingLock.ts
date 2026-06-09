import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// Jobs older than this are considered crashed or killed by Vercel's 300s timeout.
const STALE_LOCK_SECONDS = 360;

type AcquireResult =
  | { acquired: true }
  | { acquired: false; ageSeconds: number };

/**
 * Attempts to acquire a processing lock for the given project.
 *
 * Returns `{ acquired: true }` if the lock was obtained.
 * Returns `{ acquired: false, ageSeconds }` if a fresh lock already exists.
 *
 * Stale locks (age ≥ STALE_LOCK_SECONDS) are overwritten so a crashed job
 * never permanently blocks a project.
 */
export async function acquireProcessingLock(
  projectId: string,
  lockId: string,
): Promise<AcquireResult> {
  const db = createSupabaseAdminClient();

  const { data: existing } = await db
    .from('project_processing_locks')
    .select('started_at')
    .eq('project_id', projectId)
    .maybeSingle();

  if (existing) {
    const ageSeconds = (Date.now() - new Date(existing.started_at).getTime()) / 1000;
    if (ageSeconds < STALE_LOCK_SECONDS) {
      return { acquired: false, ageSeconds: Math.round(ageSeconds) };
    }
    // Stale lock from a crashed/timed-out job — fall through and overwrite it.
  }

  const { error } = await db
    .from('project_processing_locks')
    .upsert(
      { project_id: projectId, started_at: new Date().toISOString(), lock_id: lockId },
      { onConflict: 'project_id' },
    );

  if (error) {
    // Upsert failed — treat as blocked to be safe.
    return { acquired: false, ageSeconds: 0 };
  }

  return { acquired: true };
}

/**
 * Releases the lock for the given project.
 *
 * The `lockId` match ensures a late-running stale cleanup does not accidentally
 * delete a fresh lock that a different job just acquired.
 */
export async function releaseProcessingLock(
  projectId: string,
  lockId: string,
): Promise<void> {
  const db = createSupabaseAdminClient();
  await db
    .from('project_processing_locks')
    .delete()
    .eq('project_id', projectId)
    .eq('lock_id', lockId);
}
