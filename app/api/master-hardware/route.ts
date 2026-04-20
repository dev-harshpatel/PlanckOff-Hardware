import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import {
  getMasterHardwareItems,
  createMasterHardwareItem,
} from '@/lib/db/masterHardware';

// GET /api/master-hardware — list all approved items
export const GET = withAuth(async (_req: NextRequest, _ctx: AuthContext) => {
  const { data, error } = await getMasterHardwareItems();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});

// POST /api/master-hardware — manually create an item
export const POST = withAuth(async (req: NextRequest, ctx: AuthContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { name, manufacturer, description, finish, modelNumber } = body as Record<string, string>;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  }

  const { data, error } = await createMasterHardwareItem({
    name: name.trim(),
    manufacturer: (manufacturer ?? '').trim(),
    description: (description ?? '').trim(),
    finish: (finish ?? '').trim(),
    modelNumber: (modelNumber ?? '').trim(),
    createdBy: ctx.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
});
