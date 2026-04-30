import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTaxRows, replaceTaxRows } from '@/lib/db/pricing';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getTaxRows(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let body: { rows: Array<{ sort_order: number; description: string; tax_pct: number }> };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'rows must be an array.' }, { status: 400 });
    }

    for (const r of body.rows) {
      if (typeof r.description !== 'string') {
        return NextResponse.json({ error: 'Each row must have a string description.' }, { status: 400 });
      }
      if (typeof r.tax_pct !== 'number' || r.tax_pct < 0 || r.tax_pct > 999) {
        return NextResponse.json({ error: 'Each row tax_pct must be a number between 0 and 999.' }, { status: 400 });
      }
    }

    const { error } = await replaceTaxRows(projectId, body.rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ok: true } });
  },
);
