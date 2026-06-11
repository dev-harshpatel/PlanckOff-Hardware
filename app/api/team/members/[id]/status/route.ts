import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTeamMemberById, updateTeamMember } from '@/lib/db/team';
import { deleteAllSessionsForUser } from '@/lib/db/auth';

interface StatusBody {
  status?: string;
}

/**
 * PATCH /api/team/members/[id]/status — Administrator only.
 *
 * Toggles a team member between Active and Inactive. Inactive members
 * cannot log in (enforced in /api/auth/login) and their existing sessions
 * are deleted here so they are signed out immediately.
 *
 * Members still in 'Invited' state cannot be toggled — they have never
 * activated their account; use resend/delete instead.
 */
export const PATCH = withRoleAuth(
  ['Administrator'],
  async (request: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });

    let body: StatusBody;
    try {
      body = (await request.json()) as StatusBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const nextStatus = body.status;
    if (nextStatus !== 'Active' && nextStatus !== 'Inactive') {
      return NextResponse.json(
        { error: "Status must be 'Active' or 'Inactive'." },
        { status: 400 },
      );
    }

    if (ctx.user.id === id) {
      return NextResponse.json(
        { error: 'You cannot change your own status.' },
        { status: 400 },
      );
    }

    const { data: member, error: fetchError } = await getTeamMemberById(id);
    if (fetchError || !member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    if (member.status === 'Invited') {
      return NextResponse.json(
        { error: 'This member has not accepted their invite yet.' },
        { status: 400 },
      );
    }

    const { data, error } = await updateTeamMember(id, { status: nextStatus });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Deactivation must take effect immediately — kill all live sessions.
    if (nextStatus === 'Inactive') {
      await deleteAllSessionsForUser(id, 'team_member');
    }

    return NextResponse.json({ data });
  },
);
