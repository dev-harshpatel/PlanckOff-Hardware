import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTeamMemberById, updateTeamMember, deleteTeamMember } from '@/lib/db/team';

export const GET = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (_request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const { data, error } = await getTeamMemberById(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ data });
  },
);

export const PUT = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    let updates: Record<string, unknown>;
    try {
      updates = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { data, error } = await updateTeamMember(id, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const DELETE = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (_request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    const { error } = await deleteTeamMember(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  },
);
