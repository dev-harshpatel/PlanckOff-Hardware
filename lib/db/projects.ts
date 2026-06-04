import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Project, NewProjectData, ElevationType } from '@/types';
import { buildProjectLocationLabel } from '@/lib/project-locations';

// ---------------------------------------------------------------------------
// Raw DB row
// ---------------------------------------------------------------------------

interface ProjectRow {
  id: string;
  name: string;
  client: string | null;
  location: string | null;
  country: string | null;
  province: string | null;
  description: string | null;
  project_number: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  elevation_types: ElevationType[] | null;
}

// ---------------------------------------------------------------------------
// Transformer
// ---------------------------------------------------------------------------

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    client: row.client ?? '',
    location: row.location ?? '',
    country: row.country ?? undefined,
    province: row.province ?? undefined,
    description: row.description ?? '',
    projectNumber: row.project_number ?? '',
    status: (row.status as Project['status']) ?? 'Active',
    dueDate: row.due_date ?? undefined,
    assignedTo: row.assigned_to ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastModified: row.updated_at,
    elevationTypes: row.elevation_types ?? [],
    deletedAt: row.deleted_at ?? undefined,
  };
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

const BASE_SELECT = `
  id, name, client, location, country, province, description, project_number, status,
  due_date, assigned_to, deleted_at, created_by, created_at, updated_at, elevation_types
`;

export async function getProjectsForClient(clientId: string): Promise<DbResult<Project[]>> {
  try {
    const db = createSupabaseAdminClient();

    // Step 1: resolve which project IDs this Client is assigned to.
    // We do a two-step query because PostgREST join-level filtering
    // (.eq on a related table column) is unreliable across versions.
    const { data: assignments, error: assignErr } = await db
      .from('client_project_assignments')
      .select('project_id')
      .eq('client_id', clientId);

    if (assignErr) return { data: null, error: { message: assignErr.message } };
    if (!assignments || assignments.length === 0) return { data: [], error: null };

    const projectIds = (assignments as { project_id: string }[]).map((a) => a.project_id);

    // Step 2: fetch only those projects (excluding soft-deleted ones).
    const { data, error } = await db
      .from('projects')
      .select(BASE_SELECT)
      .in('id', projectIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as unknown as ProjectRow[]).map(toProject), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getAllProjects(): Promise<DbResult<Project[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('projects')
      .select(BASE_SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as unknown as ProjectRow[]).map(toProject), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getProjectById(id: string): Promise<DbResult<Project>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('projects')
      .select(BASE_SELECT)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toProject(data as unknown as ProjectRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function createProject(
  input: NewProjectData & { createdBy?: string },
): Promise<DbResult<Project>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('projects')
      .insert({
        name: input.name,
        client: input.client ?? null,
        location: input.location || buildProjectLocationLabel(input.country, input.province) || null,
        country: input.country ?? null,
        province: input.province ?? null,
        description: input.description ?? null,
        project_number: input.projectNumber ?? null,
        status: input.status ?? 'Active',
        due_date: input.dueDate ?? null,
        assigned_to: input.assignedTo ?? null,
        created_by: input.createdBy ?? null,
      })
      .select(BASE_SELECT)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toProject(data as unknown as ProjectRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function updateProject(
  id: string,
  updates: Partial<Project>,
): Promise<DbResult<Project>> {
  try {
    const db = createSupabaseAdminClient();

    const row: Record<string, unknown> = {};
    if (updates.name !== undefined)          row.name            = updates.name;
    if (updates.client !== undefined)        row.client          = updates.client;
    if (updates.location !== undefined)      row.location        = updates.location;
    if (updates.country !== undefined)       row.country         = updates.country || null;
    if (updates.province !== undefined)      row.province        = updates.province || null;
    if (updates.description !== undefined)   row.description     = updates.description;
    if (updates.projectNumber !== undefined) row.project_number  = updates.projectNumber;
    if (updates.status !== undefined)        row.status          = updates.status;
    if (updates.dueDate !== undefined)       row.due_date        = updates.dueDate;
    if (updates.assignedTo !== undefined)    row.assigned_to     = updates.assignedTo || null;
    if (updates.elevationTypes !== undefined) row.elevation_types = updates.elevationTypes;
    if (updates.location === undefined && (updates.country !== undefined || updates.province !== undefined)) {
      row.location = buildProjectLocationLabel(updates.country, updates.province) || null;
    }

    const { data, error } = await db
      .from('projects')
      .update(row)
      .eq('id', id)
      .select(BASE_SELECT)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toProject(data as unknown as ProjectRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/** Soft delete — sets deleted_at timestamp. */
export async function softDeleteProject(id: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/** Delete all files in door-elevations/{projectId}/ (recurses into subfolders). */
async function deleteProjectElevationStorage(projectId: string): Promise<void> {
  const db = createSupabaseAdminClient();
  const BUCKET = 'door-elevations';
  const SUBFOLDERS = ['door', 'frame'];

  const paths: string[] = [];
  for (const folder of SUBFOLDERS) {
    const prefix = `${projectId}/${folder}`;
    const { data: files } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (files?.length) {
      paths.push(...files.map(f => `${prefix}/${f.name}`));
    }
  }

  if (paths.length > 0) {
    await db.storage.from(BUCKET).remove(paths);
  }
}

export async function hardDeleteProject(id: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    await deleteProjectElevationStorage(id);
    const { error } = await db.from('projects').delete().eq('id', id);
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getTrashedProjects(): Promise<DbResult<Project[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('projects')
      .select(BASE_SELECT)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as unknown as ProjectRow[]).map(toProject), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function restoreProject(id: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db
      .from('projects')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/** Hard-delete any projects whose deleted_at is older than 30 days. */
export async function cleanupExpiredProjects(): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expired } = await db
      .from('projects')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', cutoff);

    if (expired?.length) {
      await Promise.all(
        (expired as { id: string }[]).map(p => deleteProjectElevationStorage(p.id)),
      );
      const ids = (expired as { id: string }[]).map(p => p.id);
      await db.from('projects').delete().in('id', ids);
    }
  } catch {
    // Non-critical — log silently
  }
}
