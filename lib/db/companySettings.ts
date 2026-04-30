import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanySettings {
  companyName: string;
  websiteUrl:  string;
  address:     string;
  country:     string;
  province:    string;
  phone:       string;
  email:       string;
  logoUrl:     string;
}

interface CompanySettingsRow {
  user_id:      string;
  company_name: string;
  website_url:  string;
  address:      string;
  country:      string;
  province:     string;
  phone:        string;
  email:        string;
  logo_url:     string;
  updated_at:   string;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY: CompanySettings = {
  companyName: '',
  websiteUrl:  '',
  address:     '',
  country:     '',
  province:    '',
  phone:       '',
  email:       '',
  logoUrl:     '',
};

function toModel(row: CompanySettingsRow): CompanySettings {
  return {
    companyName: row.company_name,
    websiteUrl:  row.website_url,
    address:     row.address,
    country:     row.country,
    province:    row.province,
    phone:       row.phone,
    email:       row.email,
    logoUrl:     row.logo_url,
  };
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export async function getCompanySettings(userId: string): Promise<DbResult<CompanySettings>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('company_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data ? toModel(data as CompanySettingsRow) : EMPTY, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function upsertCompanySettings(
  userId: string,
  settings: Partial<CompanySettings>,
): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const row: Partial<CompanySettingsRow> & { user_id: string; updated_at: string } = {
      user_id:    userId,
      updated_at: new Date().toISOString(),
    };

    if (settings.companyName !== undefined) row.company_name = settings.companyName;
    if (settings.websiteUrl  !== undefined) row.website_url  = settings.websiteUrl;
    if (settings.address     !== undefined) row.address      = settings.address;
    if (settings.country     !== undefined) row.country      = settings.country;
    if (settings.province    !== undefined) row.province     = settings.province;
    if (settings.phone       !== undefined) row.phone        = settings.phone;
    if (settings.email       !== undefined) row.email        = settings.email;
    if (settings.logoUrl     !== undefined) row.logo_url     = settings.logoUrl;

    const { error } = await db
      .from('company_settings')
      .upsert(row, { onConflict: 'user_id' });

    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
