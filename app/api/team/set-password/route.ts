import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getTeamMemberByInviteToken, updateTeamMember } from '@/lib/db/team';
import { AUTH_CONFIG } from '@/constants/auth';

interface SetPasswordBody {
  token: string;
  password: string;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

// Public — no withAuth
export async function POST(request: NextRequest) {
  let body: SetPasswordBody;
  try {
    body = (await request.json()) as SetPasswordBody;
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

  const { data: member, error: fetchError } = await getTeamMemberByInviteToken(token);
  if (fetchError || !member) {
    return NextResponse.json({ error: 'Invalid invite token.' }, { status: 404 });
  }

  if (member.inviteExpiresAt && new Date(member.inviteExpiresAt) < new Date()) {
    return NextResponse.json({ error: 'Invite token has expired.' }, { status: 410 });
  }

  const passwordHash = await bcrypt.hash(password, AUTH_CONFIG.BCRYPT_SALT_ROUNDS);

  const { error: updateError } = await updateTeamMember(member.id, {
    passwordHash,
    status: 'Active',
    inviteToken: null,
    inviteExpiresAt: null,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
