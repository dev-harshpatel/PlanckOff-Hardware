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

export type MasterHardwareSortKey = 'name' | 'manufacturer' | 'description' | 'finish';

export interface MasterHardwarePageParams {
  page: number;
  pageSize: number;
  search?: string;
  sortKey?: MasterHardwareSortKey;
  sortDir?: 'asc' | 'desc';
}

export interface MasterHardwarePage {
  items: MasterHardwareItem[];
  total: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips characters that PDF renderers inject as font artifacts:
 *  - C0/C1 control characters (except normal whitespace)
 *  - Unicode Private Use Area glyphs (U+E000–U+F8FF) — checkboxes, icons, etc.
 *  - Unicode replacement character (U+FFFD)
 * Multiple spaces are collapsed to one and the result is trimmed.
 */
export function sanitizeText(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[-]/g, '')
    .replace(/�/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function norm(s: string | null | undefined): string {
  return sanitizeText(s).toLowerCase();
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

export async function getMasterHardwareItemsPaginated(
  params: MasterHardwarePageParams,
): Promise<DbResult<MasterHardwarePage>> {
  try {
    const { page, pageSize, search, sortKey = 'name', sortDir = 'asc' } = params;
    const db = createSupabaseAdminClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = db.from('master_hardware_items').select('*', { count: 'exact' });

    if (search?.trim()) {
      const s = search.trim();
      q = q.or(
        `name.ilike.%${s}%,manufacturer.ilike.%${s}%,description.ilike.%${s}%,finish.ilike.%${s}%`,
      );
    }

    q = q.order(sortKey, { ascending: sortDir === 'asc' });

    const from = (page - 1) * pageSize;
    q = q.range(from, from + pageSize - 1);

    const { data, count, error } = await q;
    if (error) return { data: null, error: { message: error.message } };
    return {
      data: { items: (data ?? []).map(toMasterItem), total: count ?? 0 },
      error: null,
    };
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
        name: sanitizeText(payload.name),
        manufacturer: sanitizeText(payload.manufacturer),
        description: sanitizeText(payload.description),
        finish: sanitizeText(payload.finish),
        model_number: sanitizeText(payload.modelNumber),
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
    if (payload.name !== undefined) update.name = sanitizeText(payload.name);
    if (payload.manufacturer !== undefined) update.manufacturer = sanitizeText(payload.manufacturer);
    if (payload.description !== undefined) update.description = sanitizeText(payload.description);
    if (payload.finish !== undefined) update.finish = sanitizeText(payload.finish);
    if (payload.modelNumber !== undefined) update.model_number = sanitizeText(payload.modelNumber);

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
    // master_hardware_pending is checked with status='pending' ONLY — matching the
    // partial unique index design (010_fix_master_hardware_uniqueness.sql).
    // Approved/rejected rows free their slot so re-uploads can re-queue those items.
    // .range(0, 9999) prevents PostgREST's default 1000-row cap from silently truncating
    // the dedup set on large tables.
    const [masterRes, pendingRes] = await Promise.all([
      db.from('master_hardware_items').select('name,manufacturer,description,finish').range(0, 9999),
      db.from('master_hardware_pending').select('name,manufacturer,description,finish').eq('status', 'pending').range(0, 9999),
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

    // Deduplicate within the batch — the same hardware item can appear in multiple
    // sets (e.g. a standard hinge in SE01, SE02, SE03). Without this, the bulk insert
    // would conflict with itself on the partial unique index and fail entirely.
    const seenBatchKeys = new Set<string>();
    const uniqueNewItems = newItems.filter(item => {
      const k = itemKey(item);
      if (seenBatchKeys.has(k)) return false;
      seenBatchKeys.add(k);
      return true;
    });
    console.log(`[master-hw:queue] After within-batch dedup — unique=${uniqueNewItems.length}  intra-batch-dupes=${newItems.length - uniqueNewItems.length}`);

    // Log first 3 items so we can verify the shape
    console.log('[master-hw:queue] Sample items to insert:', JSON.stringify(uniqueNewItems.slice(0, 3)));

    const insertPayload = uniqueNewItems.map(item => ({
      name: sanitizeText(item.name),
      manufacturer: sanitizeText(item.manufacturer),
      description: sanitizeText(item.description),
      finish: sanitizeText(item.finish),
      model_number: sanitizeText(item.modelNumber),
      source_project_id: sourceProjectId,
      source_file_name: sourceFileName,
      status: 'pending',
      submitted_by: submittedBy,
    }));

    // upsert with ignoreDuplicates=true → ON CONFLICT DO NOTHING. .select('id') returns
    // only rows actually written so the queued count is truthful.
    // 23505 can still occur in a concurrent-upload race (two requests pass app-level dedup
    // simultaneously). Treat it as non-fatal — those items are already queued.
    const { data: insertedRows, error: insertError } = await db
      .from('master_hardware_pending')
      .upsert(insertPayload, { ignoreDuplicates: true })
      .select('id');

    if (insertError) {
      if (insertError.code === '23505') {
        console.warn('[master-hw:queue] 23505 on insert — concurrent upload race; items already queued by another request. Treating as success.');
        return { data: { queued: 0, skipped: items.length }, error: null };
      }
      console.error('[master-hw:queue] INSERT ERROR:', insertError.message, '| code:', insertError.code, '| details:', insertError.details, '| hint:', insertError.hint);
      return { data: null, error: { message: insertError.message } };
    }

    const actuallyInserted = insertedRows?.length ?? 0;
    console.log(`[master-hw:queue] SUCCESS — inserted ${actuallyInserted} rows into master_hardware_pending (unique-new=${uniqueNewItems.length}, DB-level skipped=${uniqueNewItems.length - actuallyInserted}).`);
    return { data: { queued: actuallyInserted, skipped: items.length - actuallyInserted }, error: null };
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
