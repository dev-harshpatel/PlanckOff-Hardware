import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import {
  getTeamMemberPasswordHash,
  updateTeamMember,
  getAdminPasswordHash,
  updateAdminPasswordHash,
} from '@/lib/db/team';
import { deleteAllSessionsForUser } from '@/lib/db/auth';
import { AUTH_CONFIG } from '@/constants/auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

/**
 * POST /api/auth/change-password
 *
 * Self-service: any authenticated user changes their own password.
 * Requires currentPassword verification before accepting newPassword.
 * Invalidates all sessions after the change (user must log in again).
 */
export const POST = withAuth(async (request: NextRequest, ctx: AuthContext) => {
  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;
  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: 'currentPassword and newPassword are required.' },
      { status: 400 },
    );
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

  const { user } = ctx;

  // Fetch the current password hash based on whether this is an admin or team member
  let storedHash: string | null = null;
  if (user.isAdmin) {
    const { data } = await getAdminPasswordHash(user.id);
    storedHash = data ?? null;
  } else {
    const { data } = await getTeamMemberPasswordHash(user.id);
    storedHash = data ?? null;
  }

  if (!storedHash) {
    return NextResponse.json({ error: 'Unable to verify current password.' }, { status: 500 });
  }

  const isMatch = await bcrypt.compare(currentPassword, storedHash);
  if (!isMatch) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, AUTH_CONFIG.BCRYPT_SALT_ROUNDS);

  if (user.isAdmin) {
    const { error } = await updateAdminPasswordHash(user.id, newHash);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await deleteAllSessionsForUser(user.id, 'admin');
  } else {
    const { error } = await updateTeamMember(user.id, { passwordHash: newHash });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await deleteAllSessionsForUser(user.id, 'team_member');
  }

  return NextResponse.json({ success: true });
});
