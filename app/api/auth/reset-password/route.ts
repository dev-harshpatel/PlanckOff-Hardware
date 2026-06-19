import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  getTeamMemberByResetToken,
  setTeamMemberResetToken,
  updateTeamMember,
  getAdminByResetToken,
  setAdminResetToken,
  updateAdminPasswordHash,
} from '@/lib/db/team';
import { deleteAllSessionsForUser } from '@/lib/db/auth';
import { AUTH_CONFIG } from '@/constants/auth';
import { checkRateLimit } from '@/lib/rateLimit';

interface ResetPasswordBody {
  token: string;
  password: string;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Public — no auth required
export async function POST(request: NextRequest) {
  let body: ResetPasswordBody;
  try {
    body = (await request.json()) as ResetPasswordBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { token, password } = body;
  if (!token || !password) {
    return NextResponse.json({ error: 'token and password are required.' }, { status: 400 });
  }

  if (!PASSWORD_REGEX.test(password)) {
    return NextResponse.json(
      {
        error:
          'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number.',
      },
      { status: 400 },
    );
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

  const passwordHash = await bcrypt.hash(password, AUTH_CONFIG.BCRYPT_SALT_ROUNDS);

  // Try team_members first
  const { data: member } = await getTeamMemberByResetToken(token);
  if (member) {
    if (member.resetTokenExpiresAt && new Date(member.resetTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired.' }, { status: 410 });
    }
    await updateTeamMember(member.id, { passwordHash });
    await setTeamMemberResetToken(member.id, null, null);
    await deleteAllSessionsForUser(member.id, 'team_member');
    return NextResponse.json({ success: true });
  }

  // Try admins
  const { data: admin } = await getAdminByResetToken(token);
  if (admin) {
    if (admin.resetTokenExpiresAt && new Date(admin.resetTokenExpiresAt) < new Date()) {
      return NextResponse.json({ error: 'Reset link has expired.' }, { status: 410 });
    }
    await updateAdminPasswordHash(admin.id, passwordHash);
    await setAdminResetToken(admin.id, null, null);
    await deleteAllSessionsForUser(admin.id, 'admin');
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid or expired reset link.' }, { status: 404 });
}
