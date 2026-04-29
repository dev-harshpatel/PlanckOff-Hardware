import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export interface PricingItemRow {
  category: 'door' | 'frame' | 'hardware';
  group_key: string;
  unit_price: number;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

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
