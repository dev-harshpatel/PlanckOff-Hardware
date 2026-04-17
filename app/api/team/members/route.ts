import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth, withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import {
  getAllTeamMembers,
  getAllAdmins,
  createTeamMember,
  getRoleIdByName,
  type UnifiedMember,
} from '@/lib/db/team';
import { canInviteRole, isRoleName } from '@/constants/roles';
import type { RoleName } from '@/types/auth';

/**
 * GET /api/team/members
 * Returns all users (admins + team members) unified for the team management UI.
 * Accessible by all authenticated users so the UI can show the current user's context.
 */
export const GET = withAuth(
  async (_request: NextRequest, _ctx: AuthContext) => {
    const [adminsResult, membersResult] = await Promise.all([
      getAllAdmins(),
      getAllTeamMembers(),
    ]);

    const admins: UnifiedMember[] = adminsResult.data ?? [];
    const members: UnifiedMember[] = (membersResult.data ?? []).map((m) => ({
      id: m.id,
      email: m.email,
      name: m.name,
      initials: m.initials,
      role: m.role,
      status: m.status,
      source: 'team_member' as const,
    }));

    return NextResponse.json({ data: [...admins, ...members] });
  },
);

interface CreateMemberBody {
  email: string;
  name: string;
  role: string;
  initials?: string;
}

export const POST = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (request: NextRequest, { user }: AuthContext) => {
    let body: CreateMemberBody;
    try {
      body = (await request.json()) as CreateMemberBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { email, name, role, initials } = body;
    if (!email || !name || !role) {
      return NextResponse.json({ error: 'email, name, and role are required.' }, { status: 400 });
    }

    if (!isRoleName(role)) {
      return NextResponse.json({ error: `Invalid role: ${role}` }, { status: 400 });
    }

    if (!canInviteRole(user.role as RoleName, role as RoleName)) {
      return NextResponse.json(
        { error: `Your role (${user.role}) cannot invite a ${role}.` },
        { status: 403 },
      );
    }

    const { data: roleId, error: roleError } = await getRoleIdByName(role);
    if (roleError || !roleId) {
      return NextResponse.json({ error: 'Role not found.' }, { status: 400 });
    }

    const { data, error } = await createTeamMember({
      email,
      name,
      roleId,
      initials,
      invitedBy: user.isAdmin ? undefined : user.id,
      status: 'Invited',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  },
);
