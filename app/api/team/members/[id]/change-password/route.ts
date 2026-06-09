import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import {
  getTeamMemberById,
  updateTeamMember,
  getAdminById,
  updateAdminPasswordHash,
} from '@/lib/db/team';
import { deleteAllSessionsForUser } from '@/lib/db/auth';
import { AUTH_CONFIG } from '@/constants/auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * POST /api/team/members/:id/change-password
 *
 * Administrator-only. Changes the password for any user (team member or admin).
 * Admins may change their own password or any other user's password.
 */
export const POST = withRoleAuth(
  ['Administrator'],
  async (request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'Missing member id.' }, { status: 400 });

    let body: { newPassword?: string };
    try {
      body = (await request.json()) as { newPassword?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { newPassword } = body;
    if (!newPassword) {
      return NextResponse.json({ error: 'newPassword is required.' }, { status: 400 });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number.',
        },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, AUTH_CONFIG.BCRYPT_SALT_ROUNDS);

    // Try team_members first
    const { data: teamMember, error: tmErr } = await getTeamMemberById(id);
    if (!tmErr && teamMember) {
      const { error: updateErr } = await updateTeamMember(id, { passwordHash });
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      await deleteAllSessionsForUser(id, 'team_member');
      return NextResponse.json({ success: true });
    }

    // Try admins table
    const { data: admin, error: adminErr } = await getAdminById(id);
    if (!adminErr && admin) {
      const { error: updateErr } = await updateAdminPasswordHash(id, passwordHash);
      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
      await deleteAllSessionsForUser(id, 'admin');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  },
);
