import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getProjectPricing, upsertPricingItem } from '@/lib/db/pricing';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getProjectPricing(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let body: { category: string; group_key: string; unit_price: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { category, group_key, unit_price } = body;
    if (!['door', 'frame', 'hardware'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
    }
    if (typeof unit_price !== 'number' || unit_price < 0) {
      return NextResponse.json({ error: 'unit_price must be a non-negative number.' }, { status: 400 });
    }

    const { error } = await upsertPricingItem(projectId, {
      category: category as 'door' | 'frame' | 'hardware',
      group_key,
      unit_price,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ok: true } });
  },
);
