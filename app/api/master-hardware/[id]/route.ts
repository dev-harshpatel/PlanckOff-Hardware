import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import {
  updateMasterHardwareItem,
  deleteMasterHardwareItem,
} from '@/lib/db/masterHardware';

// PUT /api/master-hardware/[id] — update an item
export const PUT = withAuth(async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
  const id = params?.id as string;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { name, manufacturer, description, finish, modelNumber } = body as Record<string, string>;

  const payload: Record<string, string> = {};
  if (name !== undefined) payload.name = name.trim();
  if (manufacturer !== undefined) payload.manufacturer = manufacturer.trim();
  if (description !== undefined) payload.description = description.trim();
  if (finish !== undefined) payload.finish = finish.trim();
  if (modelNumber !== undefined) payload.modelNumber = modelNumber.trim();

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }

  const { data, error } = await updateMasterHardwareItem(id, payload);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});

// DELETE /api/master-hardware/[id] — remove an item
export const DELETE = withAuth(async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
  const id = params?.id as string;
  const { error } = await deleteMasterHardwareItem(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
});
