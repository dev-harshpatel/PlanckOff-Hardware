import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import {
  getTeamMemberByEmail,
  createTeamMember,
  updateTeamMember,
  getRoleIdByName,
} from '@/lib/db/team';
import { sendInviteEmail } from '@/services/emailService';
import { canInviteRole, isRoleName } from '@/constants/roles';
import type { RoleName } from '@/types/auth';

interface InviteBody {
  name: string;
  email: string;
  role: string;
}

/**
 * POST /api/team/invite
 *
 * Creates a team member if they don't exist, (re)generates their invite token,
 * and sends them an invitation email with the set-password link.
 *
 * Idempotent: calling again for an existing Invited member refreshes the token
 * and resends the email.
 */
export const POST = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (request: NextRequest, { user }: AuthContext) => {
    let body: InviteBody;
    try {
      body = (await request.json()) as InviteBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { name, email, role } = body;
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'name, email, and role are required.' }, { status: 400 });
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

    // Generate invite token + expiry
    const inviteToken = crypto.randomUUID();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7);
    const inviteExpiresAtISO = inviteExpiresAt.toISOString();

    // Check if member already exists
    const { data: existing } = await getTeamMemberByEmail(email);

    let memberId: string;

    if (existing) {
      // Member exists — only allow resend if still Invited
      if (existing.status === 'Active') {
        return NextResponse.json(
          { error: 'This user already has an active account.' },
          { status: 409 },
        );
      }
      // Refresh token
      const { error: updateErr } = await updateTeamMember(existing.id, {
        inviteToken,
        inviteExpiresAt: inviteExpiresAtISO,
      });
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      memberId = existing.id;
    } else {
      // Create new member
      const { data: roleId, error: roleErr } = await getRoleIdByName(role);
      if (roleErr || !roleId) {
        return NextResponse.json({ error: 'Role not found.' }, { status: 400 });
      }

      const { data: newMember, error: createErr } = await createTeamMember({
        email,
        name,
        roleId,
        initials: name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        // Only set invitedBy if the inviter is a team_member — admins live in
        // a separate table so their ID has no matching row in team_members.
        invitedBy: user.isAdmin ? undefined : user.id,
        inviteToken,
        inviteExpiresAt: inviteExpiresAtISO,
        status: 'Invited',
      });

      if (createErr || !newMember) {
        return NextResponse.json({ error: createErr?.message ?? 'Failed to create member.' }, { status: 500 });
      }
      memberId = newMember.id;
    }

    // Send invitation email
    const { error: emailErr } = await sendInviteEmail({
      toEmail: email,
      toName: name,
      inviterName: user.name,
      role,
      inviteToken,
    });

    if (emailErr) {
      // Don't fail the whole request — member is created, just log the error
      console.error('[invite] Email send failed:', emailErr);
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      return NextResponse.json({
        success: true,
        memberId,
        emailSent: false,
        emailError: emailErr,
        inviteLink: `${baseUrl}/set-password?token=${inviteToken}`,
        expiresAt: inviteExpiresAtISO,
      });
    }

    return NextResponse.json({
      success: true,
      memberId,
      emailSent: true,
      expiresAt: inviteExpiresAtISO,
    });
  },
);
