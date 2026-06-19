import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getTeamMemberByEmail, setTeamMemberResetToken, getAdminByEmail, setAdminResetToken } from '@/lib/db/team';
import { sendPasswordResetEmail } from '@/services/emailService';
import { checkRateLimit } from '@/lib/rateLimit';

const RESET_TOKEN_EXPIRY_HOURS = 1;

// Public — no auth required
export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'email is required.' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const rl = checkRateLimit(ip);
  if (rl.limited) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } },
    );
  }

  const resetToken = randomUUID();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  // Look up in team_members first, then admins
  const { data: teamMember } = await getTeamMemberByEmail(email);
  if (teamMember && teamMember.status === 'Active') {
    await setTeamMemberResetToken(teamMember.id, resetToken, expiresAt);
    await sendPasswordResetEmail({ toEmail: teamMember.email, toName: teamMember.name, resetToken });
    return NextResponse.json({ success: true });
  }

  const { data: admin } = await getAdminByEmail(email);
  if (admin) {
    await setAdminResetToken(admin.id, resetToken, expiresAt);
    await sendPasswordResetEmail({ toEmail: admin.email, toName: admin.name, resetToken });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: 'This email is not registered on the platform.' },
    { status: 404 },
  );
}
