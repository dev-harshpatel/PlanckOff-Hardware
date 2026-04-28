import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { ProjectNotes, NoteTab } from '@/types';

interface NoteRow {
  id: string;
  project_id: string;
  hardware: Record<string, unknown> | null;
  door: Record<string, unknown> | null;
  frame: Record<string, unknown> | null;
  updated_at: string;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

function toProjectNotes(row: NoteRow): ProjectNotes {
  return {
    projectId: row.project_id,
    hardware: row.hardware,
    door: row.door,
    frame: row.frame,
  };
}

export async function getProjectNotes(projectId: string): Promise<DbResult<ProjectNotes>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_notes')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    if (!data) {
      return {
        data: { projectId, hardware: null, door: null, frame: null },
        error: null,
      };
    }
    return { data: toProjectNotes(data as NoteRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function upsertProjectNotes(
  projectId: string,
  tab: NoteTab,
  content: Record<string, unknown> | null,
): Promise<DbResult<ProjectNotes>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_notes')
      .upsert(
        { project_id: projectId, [tab]: content },
        { onConflict: 'project_id' },
      )
      .select('*')
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toProjectNotes(data as NoteRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
