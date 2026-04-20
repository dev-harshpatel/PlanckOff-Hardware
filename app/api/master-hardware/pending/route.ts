import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { getPendingHardwareItems } from '@/lib/db/masterHardware';

// GET /api/master-hardware/pending — list pending items
// Query param: ?status=pending|approved|rejected (default: pending)
export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('status') ?? 'pending';
  const status = raw === 'approved' ? 'approved' : raw === 'rejected' ? 'rejected' : 'pending';

  const { data, error } = await getPendingHardwareItems(status);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});
