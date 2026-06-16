import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmittalMeta {
  fromName:       string;
  toName:         string;
  gcName:         string;
  projectAddress: string;
  projectName:    string;
  companyName:    string;
}

interface SubmittalMetaRow {
  project_id:      string;
  from_name:       string;
  to_name:         string;
  gc_name:         string;
  project_address: string;
  project_name:    string;
  company_name:    string;
  updated_at:      string;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY: SubmittalMeta = {
  fromName:       '',
  toName:         '',
  gcName:         '',
  projectAddress: '',
  projectName:    '',
  companyName:    '',
};

function toModel(row: SubmittalMetaRow): SubmittalMeta {
  return {
    fromName:       row.from_name,
    toName:         row.to_name,
    gcName:         row.gc_name,
    projectAddress: row.project_address,
    projectName:    row.project_name,
    companyName:    row.company_name,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export async function getSubmittalMeta(projectId: string): Promise<DbResult<SubmittalMeta>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_submittal_metadata')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data ? toModel(data as SubmittalMetaRow) : EMPTY, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function upsertSubmittalMeta(
  projectId: string,
  meta: Partial<SubmittalMeta>,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const row: Partial<SubmittalMetaRow> & { project_id: string; updated_at: string } = {
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };

    if (meta.fromName       !== undefined) row.from_name       = meta.fromName;
    if (meta.toName         !== undefined) row.to_name         = meta.toName;
    if (meta.gcName         !== undefined) row.gc_name         = meta.gcName;
    if (meta.projectAddress !== undefined) row.project_address = meta.projectAddress;
    if (meta.projectName    !== undefined) row.project_name    = meta.projectName;
    if (meta.companyName    !== undefined) row.company_name    = meta.companyName;

    const { error } = await db
      .from('project_submittal_metadata')
      .upsert(row, { onConflict: 'project_id' });

    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
