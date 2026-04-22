import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MasterHardwareItem {
  id: string;
  name: string;
  manufacturer: string;
  description: string;
  finish: string;
  modelNumber: string;
  sourceProjectId: string | null;
  sourceFileName: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MasterHardwarePending {
  id: string;
  name: string;
  manufacturer: string;
  description: string;
  finish: string;
  modelNumber: string;
  sourceProjectId: string | null;
  sourceFileName: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: string | null;
  reviewedBy: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface CandidateItem {
  name: string;
  manufacturer: string;
  description: string;
  finish: string;
  modelNumber?: string;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim();
}

function itemKey(item: { name: string; manufacturer: string; description: string; finish: string }): string {
  return `${norm(item.name)}|${norm(item.manufacturer)}|${norm(item.description)}|${norm(item.finish)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMasterItem(row: any): MasterHardwareItem {
  return {
    id: row.id,
    name: row.name ?? '',
    manufacturer: row.manufacturer ?? '',
    description: row.description ?? '',
    finish: row.finish ?? '',
    modelNumber: row.model_number ?? '',
    sourceProjectId: row.source_project_id ?? null,
    sourceFileName: row.source_file_name ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPendingItem(row: any): MasterHardwarePending {
  return {
    id: row.id,
    name: row.name ?? '',
    manufacturer: row.manufacturer ?? '',
    description: row.description ?? '',
    finish: row.finish ?? '',
    modelNumber: row.model_number ?? '',
    sourceProjectId: row.source_project_id ?? null,
    sourceFileName: row.source_file_name ?? null,
    status: row.status,
    submittedBy: row.submitted_by ?? null,
    reviewedBy: row.reviewed_by ?? null,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Master Items — CRUD
// ---------------------------------------------------------------------------

export async function getMasterHardwareItems(): Promise<DbResult<MasterHardwareItem[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('master_hardware_items')
      .select()
      .order('name');
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []).map(toMasterItem), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function createMasterHardwareItem(
  payload: CandidateItem & { sourceProjectId?: string; sourceFileName?: string; createdBy?: string },
): Promise<DbResult<MasterHardwareItem>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('master_hardware_items')
      .insert({
        name: payload.name,
        manufacturer: payload.manufacturer ?? '',
        description: payload.description ?? '',
        finish: payload.finish ?? '',
        model_number: payload.modelNumber ?? '',
        source_project_id: payload.sourceProjectId ?? null,
        source_file_name: payload.sourceFileName ?? null,
        created_by: payload.createdBy ?? null,
      })
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data: toMasterItem(data), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function updateMasterHardwareItem(
  id: string,
  payload: Partial<Pick<MasterHardwareItem, 'name' | 'manufacturer' | 'description' | 'finish' | 'modelNumber'>>,
): Promise<DbResult<MasterHardwareItem>> {
  try {
    const db = createSupabaseAdminClient();
    const update: Record<string, string> = {};
    if (payload.name !== undefined) update.name = payload.name;
    if (payload.manufacturer !== undefined) update.manufacturer = payload.manufacturer;
    if (payload.description !== undefined) update.description = payload.description;
    if (payload.finish !== undefined) update.finish = payload.finish;
    if (payload.modelNumber !== undefined) update.model_number = payload.modelNumber;

    const { data, error } = await db
      .from('master_hardware_items')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) return { data: null, error: { message: error.message } };
    return { data: toMasterItem(data), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function deleteMasterHardwareItem(
  id: string,
): Promise<{ error: { message: string } | null }> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('master_hardware_items').delete().eq('id', id);
    if (error) return { error: { message: error.message } };
    return { error: null };
  } catch (err) {
    return { error: { message: String(err) } };
  }
}

// ---------------------------------------------------------------------------
// Pending Queue
// ---------------------------------------------------------------------------

export async function getPendingHardwareItems(
  status: 'pending' | 'approved' | 'rejected' = 'pending',
): Promise<DbResult<MasterHardwarePending[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('master_hardware_pending')
      .select()
      .eq('status', status)
      .order('submitted_at', { ascending: false });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []).map(toPendingItem), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/**
 * Given items extracted from a PDF, queue those that are not already in
 * master_hardware_items or master_hardware_pending (status=pending).
 * Uniqueness: all four fields (name, manufacturer, description, finish) must
 * match an existing row for it to be considered a duplicate.
 */
export async function queueItemsForApproval(
  items: CandidateItem[],
  sourceProjectId: string,
  sourceFileName: string,
  submittedBy: string,
): Promise<DbResult<{ queued: number; skipped: number }>> {
  console.log(`[master-hw:queue] Called — candidates=${items.length}  project=${sourceProjectId}  file="${sourceFileName}"  user=${submittedBy}`);

  if (items.length === 0) {
    console.log('[master-hw:queue] No candidate items — returning early.');
    return { data: { queued: 0, skipped: 0 }, error: null };
  }

  try {
    const db = createSupabaseAdminClient();
    console.log('[master-hw:queue] Supabase admin client created.');

    // Fetch existing keys from both tables in parallel.
    // master_hardware_pending is checked across ALL statuses (not just 'pending') so
    // approved and rejected items from previous runs are also treated as duplicates.
    const [masterRes, pendingRes] = await Promise.all([
      db.from('master_hardware_items').select('name,manufacturer,description,finish'),
      db.from('master_hardware_pending').select('name,manufacturer,description,finish'),
    ]);

    if (masterRes.error) {
      console.error('[master-hw:queue] ERROR reading master_hardware_items:', masterRes.error.message, '| code:', masterRes.error.code);
      return { data: null, error: { message: `master_hardware_items read failed: ${masterRes.error.message}` } };
    }
    if (pendingRes.error) {
      console.error('[master-hw:queue] ERROR reading master_hardware_pending:', pendingRes.error.message, '| code:', pendingRes.error.code);
      return { data: null, error: { message: `master_hardware_pending read failed: ${pendingRes.error.message}` } };
    }

    console.log(`[master-hw:queue] Existing master rows=${masterRes.data?.length ?? 0}  pending rows=${pendingRes.data?.length ?? 0}`);

    const existingKeys = new Set([
      ...(masterRes.data ?? []).map(itemKey),
      ...(pendingRes.data ?? []).map(itemKey),
    ]);

    const newItems = items.filter(item => !existingKeys.has(itemKey(item)));
    console.log(`[master-hw:queue] After dedup — new=${newItems.length}  already-existing=${items.length - newItems.length}`);

    if (newItems.length === 0) {
      console.log('[master-hw:queue] All items are duplicates — nothing to insert.');
      return { data: { queued: 0, skipped: items.length }, error: null };
    }

    // Log first 3 items so we can verify the shape
    console.log('[master-hw:queue] Sample items to insert:', JSON.stringify(newItems.slice(0, 3)));

    const insertPayload = newItems.map(item => ({
      name: item.name,
      manufacturer: item.manufacturer ?? '',
      description: item.description ?? '',
      finish: item.finish ?? '',
      model_number: item.modelNumber ?? '',
      source_project_id: sourceProjectId,
      source_file_name: sourceFileName,
      status: 'pending',
      submitted_by: submittedBy,
    }));

    // Use upsert with ignoreDuplicates so concurrent uploads don't race-insert
    // duplicates that slip past the application-level dedup above.
    // The DB partial unique index (status='pending') is the final safety net.
    const { error: insertError } = await db
      .from('master_hardware_pending')
      .upsert(insertPayload, { ignoreDuplicates: true });

    if (insertError) {
      console.error('[master-hw:queue] INSERT ERROR:', insertError.message, '| code:', insertError.code, '| details:', insertError.details, '| hint:', insertError.hint);
      return { data: null, error: { message: insertError.message } };
    }

    console.log(`[master-hw:queue] SUCCESS — inserted ${newItems.length} rows into master_hardware_pending.`);
    return { data: { queued: newItems.length, skipped: items.length - newItems.length }, error: null };
  } catch (err) {
    console.error('[master-hw:queue] UNEXPECTED EXCEPTION:', err);
    return { data: null, error: { message: String(err) } };
  }
}

/**
 * Approve or reject a batch of pending items by ID.
 * Approved items are immediately inserted into master_hardware_items.
 */
export async function reviewPendingBatch(
  ids: string[],
  action: 'approve' | 'reject',
  reviewedBy: string,
): Promise<DbResult<{ processed: number }>> {
  console.log(`[master-hw:review] Called — action=${action}  ids=${ids.length}  user=${reviewedBy}`);

  if (ids.length === 0) return { data: { processed: 0 }, error: null };

  // PostgREST encodes .in() filters as URL params — large batches exceed the limit.
  // Process in chunks of 100 to stay well under it.
  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  try {
    const db = createSupabaseAdminClient();
    const status = action === 'approve' ? 'approved' : 'rejected';
    const reviewedAt = new Date().toISOString();

    const allUpdated: Record<string, unknown>[] = [];

    for (const chunk of chunks) {
      const { data: updated, error: updateError } = await db
        .from('master_hardware_pending')
        .update({ status, reviewed_by: reviewedBy, reviewed_at: reviewedAt })
        .in('id', chunk)
        .eq('status', 'pending')
        .select();

      if (updateError) {
        console.error('[master-hw:review] UPDATE ERROR:', updateError.message, '| code:', updateError.code);
        return { data: null, error: { message: updateError.message } };
      }

      if (updated) allUpdated.push(...updated);
    }

    console.log(`[master-hw:review] Updated ${allUpdated.length} pending rows to status="${status}"`);

    if (action === 'approve' && allUpdated.length > 0) {
      // Fetch current master keys so we can skip items that already exist.
      // This handles the case where the same item was approved twice (e.g. via
      // two separate pending rows that slipped through before the unique index).
      const { data: existingMaster, error: masterReadErr } = await db
        .from('master_hardware_items')
        .select('name,manufacturer,description,finish');
      if (masterReadErr) {
        console.error('[master-hw:review] Failed to read existing master items:', masterReadErr.message);
        return { data: null, error: { message: masterReadErr.message } };
      }
      const existingMasterKeys = new Set((existingMaster ?? []).map(itemKey));

      const rowsToInsert = allUpdated.filter(row =>
        !existingMasterKeys.has(itemKey({
          name:         String(row.name ?? ''),
          manufacturer: String(row.manufacturer ?? ''),
          description:  String(row.description ?? ''),
          finish:       String(row.finish ?? ''),
        })),
      );

      console.log(
        `[master-hw:review] Inserting ${rowsToInsert.length} rows into master_hardware_items ` +
        `(${allUpdated.length - rowsToInsert.length} already existed — skipped)...`,
      );

      // Insert in chunks; use upsert+ignoreDuplicates as a DB-level safety net
      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        const insertChunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
        const { error: insertError } = await db.from('master_hardware_items').upsert(
          insertChunk.map(row => ({
            name:              row.name,
            manufacturer:      row.manufacturer,
            description:       row.description,
            finish:            row.finish,
            model_number:      row.model_number,
            source_project_id: row.source_project_id,
            source_file_name:  row.source_file_name,
            created_by:        reviewedBy,
          })),
          { ignoreDuplicates: true },
        );
        if (insertError) {
          console.error('[master-hw:review] INSERT INTO master_hardware_items ERROR:', insertError.message, '| code:', insertError.code, '| hint:', insertError.hint);
          return { data: null, error: { message: insertError.message } };
        }
      }

      console.log(`[master-hw:review] SUCCESS — ${rowsToInsert.length} items moved to master_hardware_items.`);
    }

    return { data: { processed: allUpdated.length }, error: null };
  } catch (err) {
    console.error('[master-hw:review] UNEXPECTED EXCEPTION:', err);
    return { data: null, error: { message: String(err) } };
  }
}
