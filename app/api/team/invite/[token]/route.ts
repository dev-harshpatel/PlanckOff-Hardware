import { NextRequest, NextResponse } from 'next/server';
import { getTeamMemberByInviteToken } from '@/lib/db/team';

// Public — no withAuth
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  const { data: member, error } = await getTeamMemberByInviteToken(token);

  if (error || !member) {
    return NextResponse.json({ error: 'Invalid invite token.' }, { status: 404 });
  }

  // Check expiry
  if (member.inviteExpiresAt && new Date(member.inviteExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invite token has expired.' }, { status: 410 });
  }

  return NextResponse.json({
    data: {
      name: member.name,
      email: member.email,
      role: member.role,
    },
  });
}
