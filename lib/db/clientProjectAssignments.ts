import { createSupabaseAdminClient } from '@/lib/supabase/admin';

type DbResult<T> = { data: T | null; error: { message: string } | null };

/**
 * Replace a Client's project assignments in full.
 * Deletes all existing rows for the client, then inserts the new set.
 * Passing an empty projectIds array clears all assignments.
 */
export async function assignProjectsToClient(
  clientId: string,
  projectIds: string[],
  assignedById: string | null,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();

    const { error: deleteErr } = await db
      .from('client_project_assignments')
      .delete()
      .eq('client_id', clientId);

    if (deleteErr) return { data: null, error: { message: deleteErr.message } };
    if (projectIds.length === 0) return { data: true, error: null };

    const { error: insertErr } = await db.from('client_project_assignments').insert(
      projectIds.map((pid) => ({
        client_id: clientId,
        project_id: pid,
        assigned_by: assignedById,
      })),
    );

    if (insertErr) return { data: null, error: { message: insertErr.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/**
 * Returns true when the Client has an assignment row for the given project.
 * Returns false on any error — callers treat this as "not found".
 */
export async function isClientAssignedToProject(
  clientId: string,
  projectId: string,
): Promise<boolean> {
  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from('client_project_assignments')
      .select('id')
      .eq('client_id', clientId)
      .eq('project_id', projectId)
      .single();
    return !!data;
  } catch {
    return false;
  }
}

/** Returns all project IDs assigned to a Client user. */
export async function getAssignedProjectIds(clientId: string): Promise<DbResult<string[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('client_project_assignments')
      .select('project_id')
      .eq('client_id', clientId);

    if (error) return { data: null, error: { message: error.message } };
    return {
      data: (data as { project_id: string }[]).map((r) => r.project_id),
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
