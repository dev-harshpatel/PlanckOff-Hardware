import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PROJECT_LOCATION_OPTIONS, type CountryOption } from '@/lib/project-locations';

interface ProjectLocationRow {
  country_code: string;
  country_name: string;
  province_code: string;
  province_name: string;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

export async function getProjectLocationOptions(): Promise<DbResult<CountryOption[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_location_provinces')
      .select('country_code, country_name, province_code, province_name')
      .order('country_name', { ascending: true })
      .order('province_name', { ascending: true });

    if (error) {
      return { data: PROJECT_LOCATION_OPTIONS, error: null };
    }

    const rows = (data as ProjectLocationRow[]) ?? [];
    if (rows.length === 0) {
      return { data: PROJECT_LOCATION_OPTIONS, error: null };
    }

    const grouped = rows.reduce<Map<string, CountryOption>>((acc, row) => {
      const existing = acc.get(row.country_code);
      if (existing) {
        existing.provinces.push({ code: row.province_code, name: row.province_name });
      } else {
        acc.set(row.country_code, {
          code: row.country_code,
          name: row.country_name,
          provinces: [{ code: row.province_code, name: row.province_name }],
        });
      }
      return acc;
    }, new Map());

    return { data: Array.from(grouped.values()), error: null };
  } catch (err) {
    return { data: PROJECT_LOCATION_OPTIONS, error: { message: String(err) } };
  }
}
