import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface PricingItemRow {
  category: 'door' | 'frame' | 'hardware';
  group_key: string;
  unit_price: number;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ─── Pricing variants ─────────────────────────────────────────────────────────

export interface PricingVariant {
  key: string;           // e.g. "vprice-1714300000000"
  label: string;         // user-visible name
  category: 'door' | 'frame';
  doorIds: string[];
}

const VARIANT_CAT = 'pricing_variant';

function metaKey(variantKey: string, cat: string, label: string): string {
  return `meta|${variantKey}|${cat}|${label}`;
}
function memberKey(variantKey: string, doorId: string): string {
  return `member|${variantKey}|${doorId}`;
}
function parseMeta(gk: string): { variantKey: string; category: 'door' | 'frame'; label: string } | null {
  if (!gk.startsWith('meta|')) return null;
  const parts = gk.split('|');
  if (parts.length < 4) return null;
  // format: meta|variantKey|category|...label (label may contain pipes)
  const [, variantKey, category, ...labelParts] = parts;
  return { variantKey, category: category as 'door' | 'frame', label: labelParts.join('|') };
}
function parseMember(gk: string): { variantKey: string; doorId: string } | null {
  if (!gk.startsWith('member|')) return null;
  const parts = gk.split('|');
  if (parts.length < 3) return null;
  return { variantKey: parts[1], doorId: parts.slice(2).join('|') };
}

export async function getPricingVariants(projectId: string): Promise<DbResult<PricingVariant[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_pricing_items')
      .select('group_key')
      .eq('project_id', projectId)
      .eq('category', VARIANT_CAT);
    if (error) return { data: null, error: { message: error.message } };
    const rows = (data ?? []) as { group_key: string }[];
    const metaMap = new Map<string, { label: string; category: 'door' | 'frame' }>();
    const memberMap = new Map<string, string[]>();
    for (const row of rows) {
      const meta = parseMeta(row.group_key);
      if (meta) { metaMap.set(meta.variantKey, { label: meta.label, category: meta.category }); continue; }
      const member = parseMember(row.group_key);
      if (member) {
        if (!memberMap.has(member.variantKey)) memberMap.set(member.variantKey, []);
        memberMap.get(member.variantKey)!.push(member.doorId);
      }
    }
    const variants: PricingVariant[] = Array.from(metaMap.entries()).map(([key, m]) => ({
      key, label: m.label, category: m.category, doorIds: memberMap.get(key) ?? [],
    }));
    return { data: variants, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function upsertPricingVariant(projectId: string, variant: PricingVariant): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    // Remove existing memberships in OTHER variants for these doors (cross-variant move)
    if (variant.doorIds.length > 0) {
      const { data: allMembers } = await db
        .from('project_pricing_items')
        .select('group_key')
        .eq('project_id', projectId)
        .eq('category', VARIANT_CAT)
        .like('group_key', 'member|%');
      if (allMembers) {
        const stale = (allMembers as { group_key: string }[])
          .filter(r => { const m = parseMember(r.group_key); return m && variant.doorIds.includes(m.doorId) && m.variantKey !== variant.key; })
          .map(r => r.group_key);
        if (stale.length > 0) {
          await db.from('project_pricing_items').delete().eq('project_id', projectId).eq('category', VARIANT_CAT).in('group_key', stale);
        }
      }
    }
    const rows = [
      { project_id: projectId, category: VARIANT_CAT, group_key: metaKey(variant.key, variant.category, variant.label), unit_price: 0, updated_at: new Date().toISOString() },
      ...variant.doorIds.map(id => ({ project_id: projectId, category: VARIANT_CAT, group_key: memberKey(variant.key, id), unit_price: 0, updated_at: new Date().toISOString() })),
    ];
    const { error } = await db.from('project_pricing_items').upsert(rows, { onConflict: 'project_id,category,group_key' });
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function deletePricingVariant(projectId: string, variantKey: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    await Promise.all([
      db.from('project_pricing_items').delete().eq('project_id', projectId).eq('category', VARIANT_CAT).like('group_key', `meta|${variantKey}|%`),
      db.from('project_pricing_items').delete().eq('project_id', projectId).eq('category', VARIANT_CAT).like('group_key', `member|${variantKey}|%`),
    ]);
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getProjectPricing(projectId: string): Promise<DbResult<PricingItemRow[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_pricing_items')
      .select('category, group_key, unit_price')
      .eq('project_id', projectId);
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []) as PricingItemRow[], error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function upsertPricingItem(
  projectId: string,
  item: PricingItemRow,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db
      .from('project_pricing_items')
      .upsert(
        {
          project_id:  projectId,
          category:    item.category,
          group_key:   item.group_key,
          unit_price:  item.unit_price,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'project_id,category,group_key' },
      );
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

// ─── Proposal profit percentages + settings ──────────────────────────────────

export interface ProposalProfitRow {
  profit_door:       number;
  profit_frame:      number;
  profit_hardware:   number;
  allocate_expenses: boolean;
  remarks:           string;
}

export async function getProposalProfit(projectId: string): Promise<DbResult<ProposalProfitRow>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_pricing_proposal')
      .select('profit_door, profit_frame, profit_hardware, allocate_expenses, remarks')
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) {
      console.error('[getProposalProfit] Supabase error:', error);
      return { data: null, error: { message: error.message } };
    }
    return {
      data: data ?? { profit_door: 0, profit_frame: 0, profit_hardware: 0, allocate_expenses: false, remarks: '' },
      error: null,
    };
  } catch (err) {
    console.error('[getProposalProfit] Caught exception:', err);
    return { data: null, error: { message: String(err) } };
  }
}

export async function upsertProposalProfit(
  projectId: string,
  row: ProposalProfitRow,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db
      .from('project_pricing_proposal')
      .upsert(
        {
          project_id:        projectId,
          profit_door:       row.profit_door,
          profit_frame:      row.profit_frame,
          profit_hardware:   row.profit_hardware,
          allocate_expenses: row.allocate_expenses,
          remarks:           row.remarks,
          updated_at:        new Date().toISOString(),
        },
        { onConflict: 'project_id' },
      );
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

// ─── Proposal extra expenses ──────────────────────────────────────────────────

export interface ProposalExpenseRow {
  id:          string;
  sort_order:  number;
  delivery:    string;
  total_price: number;
}

export async function getProposalExpenses(projectId: string): Promise<DbResult<ProposalExpenseRow[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_proposal_expenses')
      .select('id, sort_order, delivery, total_price')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []) as ProposalExpenseRow[], error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function replaceProposalExpenses(
  projectId: string,
  expenses: Array<{ sort_order: number; delivery: string; total_price: number }>,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    await db.from('project_proposal_expenses').delete().eq('project_id', projectId);
    if (expenses.length > 0) {
      const { error } = await db.from('project_proposal_expenses').insert(
        expenses.map(e => ({
          project_id:  projectId,
          sort_order:  e.sort_order,
          delivery:    e.delivery,
          total_price: e.total_price,
          updated_at:  new Date().toISOString(),
        })),
      );
      if (error) return { data: null, error: { message: error.message } };
    }
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

// ─── Proposal tax rows ────────────────────────────────────────────────────────

export interface TaxRowRow {
  id:          string;
  sort_order:  number;
  description: string;
  tax_pct:     number;
}

export async function getTaxRows(projectId: string): Promise<DbResult<TaxRowRow[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_proposal_tax_rows')
      .select('id, sort_order, description, tax_pct')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });
    if (error) return { data: null, error: { message: error.message } };
    return { data: (data ?? []) as TaxRowRow[], error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function replaceTaxRows(
  projectId: string,
  rows: Array<{ sort_order: number; description: string; tax_pct: number }>,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    await db.from('project_proposal_tax_rows').delete().eq('project_id', projectId);
    if (rows.length > 0) {
      const { error } = await db.from('project_proposal_tax_rows').insert(
        rows.map(r => ({
          project_id:  projectId,
          sort_order:  r.sort_order,
          description: r.description,
          tax_pct:     r.tax_pct,
          updated_at:  new Date().toISOString(),
        })),
      );
      if (error) return { data: null, error: { message: error.message } };
    }
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
