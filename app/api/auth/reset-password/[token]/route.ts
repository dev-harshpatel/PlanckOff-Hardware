import { NextRequest, NextResponse } from 'next/server';
import { getTeamMemberByResetToken, getAdminByResetToken } from '@/lib/db/team';

// Public — validate a reset token and return the user's name/email
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
  }

  // Check team_members first
  const { data: member } = await getTeamMemberByResetToken(token);
  if (member) {
    if (member.resetTokenExpiresAt && new Date(member.resetTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired.' }, { status: 410 });
    }
    return NextResponse.json({ data: { name: member.name, email: member.email } });
  }

  // Check admins
  const { data: admin } = await getAdminByResetToken(token);
  if (admin) {
    if (admin.resetTokenExpiresAt && new Date(admin.resetTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired.' }, { status: 410 });
    }
    return NextResponse.json({ data: { name: admin.name, email: admin.email } });
  }

  return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 404 });
}
