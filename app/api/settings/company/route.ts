import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { getCompanySettings, upsertCompanySettings } from '@/lib/db/companySettings';
import type { CompanySettings } from '@/lib/db/companySettings';

export const GET = withAuth(async (_req: NextRequest, { user }: AuthContext) => {
  const { data, error } = await getCompanySettings(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});

export const PUT = withAuth(async (req: NextRequest, { user }: AuthContext) => {
  let body: Partial<CompanySettings>;
  try {
    body = (await req.json()) as Partial<CompanySettings>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { data, error } = await upsertCompanySettings(user.id, body);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});
