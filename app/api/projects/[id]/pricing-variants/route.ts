import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getPricingVariants, upsertPricingVariant, deletePricingVariant, type PricingVariant } from '@/lib/db/pricing';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getPricingVariants(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    let body: { variant: PricingVariant };
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
    const { variant } = body;
    if (!variant?.key || !variant.label || !['door', 'frame'].includes(variant.category)) {
      return NextResponse.json({ error: 'Invalid variant payload.' }, { status: 400 });
    }
    const { error } = await upsertPricingVariant(projectId, variant);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ok: true } });
  },
);

export const DELETE = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { searchParams } = new URL(req.url);
    const variantKey = searchParams.get('variantKey');
    if (!variantKey) return NextResponse.json({ error: 'variantKey query param required.' }, { status: 400 });
    const { error } = await deletePricingVariant(projectId, variantKey);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ok: true } });
  },
);
