import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getProposalProfit, upsertProposalProfit } from '@/lib/db/pricing';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getProposalProfit(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let body: { profit_door: number; profit_frame: number; profit_hardware: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { profit_door, profit_frame, profit_hardware } = body;
    for (const [field, val] of Object.entries({ profit_door, profit_frame, profit_hardware })) {
      if (typeof val !== 'number' || val < 0 || val > 999) {
        return NextResponse.json({ error: `${field} must be a number between 0 and 999.` }, { status: 400 });
      }
    }

    const { error } = await upsertProposalProfit(projectId, { profit_door, profit_frame, profit_hardware });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ok: true } });
  },
);
