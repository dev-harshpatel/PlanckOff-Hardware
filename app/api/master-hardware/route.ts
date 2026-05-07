import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import {
  getMasterHardwareItems,
  getMasterHardwareItemsPaginated,
  createMasterHardwareItem,
  type MasterHardwareSortKey,
} from '@/lib/db/masterHardware';

const VALID_SORT_KEYS: MasterHardwareSortKey[] = ['name', 'manufacturer', 'description', 'finish'];

// GET /api/master-hardware — paginated list (or full export with ?export=true)
export const GET = withAuth(async (req: NextRequest, _ctx: AuthContext) => {
  const { searchParams } = new URL(req.url);

  if (searchParams.get('export') === 'true') {
    const { data, error } = await getMasterHardwareItems();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') ?? '25', 10) || 25));
  const search   = searchParams.get('search') ?? '';
  const rawKey   = searchParams.get('sortKey') ?? 'name';
  const rawDir   = searchParams.get('sortDir') ?? 'asc';

  const sortKey: MasterHardwareSortKey = VALID_SORT_KEYS.includes(rawKey as MasterHardwareSortKey)
    ? (rawKey as MasterHardwareSortKey)
    : 'name';
  const sortDir = rawDir === 'desc' ? 'desc' : 'asc';

  const { data, error } = await getMasterHardwareItemsPaginated({
    page,
    pageSize,
    search,
    sortKey,
    sortDir,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data?.items ?? [], total: data?.total ?? 0 });
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
