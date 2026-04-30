import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getProposalExpenses, replaceProposalExpenses } from '@/lib/db/pricing';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getProposalExpenses(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let body: { expenses: Array<{ sort_order: number; delivery: string; total_price: number }> };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!Array.isArray(body.expenses)) {
      return NextResponse.json({ error: 'expenses must be an array.' }, { status: 400 });
    }

    for (const e of body.expenses) {
      if (typeof e.delivery !== 'string') {
        return NextResponse.json({ error: 'Each expense must have a string delivery field.' }, { status: 400 });
      }
      if (typeof e.total_price !== 'number' || e.total_price < 0) {
        return NextResponse.json({ error: 'Each expense total_price must be a non-negative number.' }, { status: 400 });
      }
    }

    const { error } = await replaceProposalExpenses(projectId, body.expenses);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ok: true } });
  },
);
