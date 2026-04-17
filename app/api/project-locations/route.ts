import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { getProjectLocationOptions } from '@/lib/db/projectLocations';

export const GET = withAuth(async (_req: NextRequest, _ctx: AuthContext) => {
  const { data, error } = await getProjectLocationOptions();
  if (error && !data) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
});
