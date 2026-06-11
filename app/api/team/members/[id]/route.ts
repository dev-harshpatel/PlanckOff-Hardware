import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTeamMemberById, updateTeamMember, deleteTeamMember } from '@/lib/db/team';
import { deleteAllSessionsForUser } from '@/lib/db/auth';

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
  async (request: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    let updates: Record<string, unknown>;
    try {
      updates = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    // Status changes are Administrator-only — see /api/team/members/[id]/status.
    if ('status' in updates && ctx.user.role !== 'Administrator') {
      return NextResponse.json(
        { error: 'Only Administrators can change member status.' },
        { status: 403 },
      );
    }

    const { data, error } = await updateTeamMember(id, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const DELETE = withRoleAuth(
  ['Administrator'],
  async (_request: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    if (ctx.user.id === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 },
      );
    }

    // Remove live sessions first so the user is signed out immediately
    // and the team_members row has no dependent auth_sessions rows.
    await deleteAllSessionsForUser(id, 'team_member');

    const { error } = await deleteTeamMember(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  },
);
