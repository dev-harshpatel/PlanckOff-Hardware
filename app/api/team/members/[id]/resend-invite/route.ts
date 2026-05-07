import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTeamMemberById, updateTeamMember } from '@/lib/db/team';
import { sendInviteEmail } from '@/services/emailService';
import { canInviteRole } from '@/constants/roles';
import type { RoleName } from '@/types/auth';

const INVITE_EXPIRY_DAYS = 7;

/**
 * POST /api/team/members/:id/resend-invite
 *
 * Refreshes the invite token (new UUID, new 7-day expiry) for a member who
 * is still in the Invited state and resends the invitation email.
 *
 * Guards:
 *   - Caller must be Administrator or Team Lead.
 *   - Member must still be in Invited status (not Active).
 *   - Caller's role must be permitted to invite the member's role.
 */
export const POST = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (_req: NextRequest, { user }: AuthContext, params?: RouteParams) => {
    const id = params?.id as string | undefined;
    if (!id) return NextResponse.json({ error: 'Missing member id.' }, { status: 400 });

    // Fetch the target member
    const { data: member, error: fetchErr } = await getTeamMemberById(id);
    if (fetchErr || !member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    // Only resend to members who haven't accepted yet
    if (member.status === 'Active') {
      return NextResponse.json(
        { error: 'This user already has an active account.' },
        { status: 409 },
      );
    }

    // Enforce role hierarchy — caller must be allowed to invite this member's role
    if (!canInviteRole(user.role as RoleName, member.role)) {
      return NextResponse.json(
        { error: `Your role (${user.role}) cannot resend an invite to a ${member.role}.` },
        { status: 403 },
      );
    }

    // Rotate token and extend expiry
    const inviteToken = crypto.randomUUID();
    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + INVITE_EXPIRY_DAYS);
    const inviteExpiresAtISO = inviteExpiresAt.toISOString();

    const { error: updateErr } = await updateTeamMember(id, {
      inviteToken,
      inviteExpiresAt: inviteExpiresAtISO,
    });
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Send the invitation email
    const { error: emailErr } = await sendInviteEmail({
      toEmail:    member.email,
      toName:     member.name,
      role:       member.role,
      inviteToken,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteLink = `${baseUrl}/set-password?token=${inviteToken}`;

    if (emailErr) {
      console.error('[resend-invite] Email send failed:', emailErr);
      return NextResponse.json({
        success: true,
        emailSent: false,
        emailError: emailErr,
        inviteLink,
        expiresAt: inviteExpiresAtISO,
      });
    }

    return NextResponse.json({
      success: true,
      emailSent: true,
      expiresAt: inviteExpiresAtISO,
    });
  },
);
