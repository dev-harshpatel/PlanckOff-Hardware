import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { reviewPendingBatch } from '@/lib/db/masterHardware';

// POST /api/master-hardware/pending/review
// Body: { ids: string[]; action: 'approve' | 'reject' }
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { ids, action } = body as { ids: unknown; action: unknown };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids must be a non-empty array.' }, { status: 400 });
  }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject".' }, { status: 400 });
  }

  const { data, error } = await reviewPendingBatch(
    ids as string[],
    action,
    ctx.user.id,
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});
