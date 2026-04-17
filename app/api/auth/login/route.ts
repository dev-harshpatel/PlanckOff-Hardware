import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSession, computeNewExpiry } from '@/lib/db/auth';
import { getTeamMemberByEmail } from '@/lib/db/team';
import { setAuthCookie } from '@/lib/auth/api-helpers';
import type { RoleName } from '@/types/auth';

interface LoginBody {
  email: string;
  password: string;
}

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string | null;
  password_hash: string;
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { email, password } = body;
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const ipAddress =
    request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;

  // -------------------------------------------------------------------------
  // 1. Try team_members first (status must be Active)
  // -------------------------------------------------------------------------
  const { data: member } = await getTeamMemberByEmail(email);

  if (member) {
    if (member.status !== 'Active') {
      return NextResponse.json(
        { error: 'Account is not active. Please accept your invitation first.' },
        { status: 403 },
      );
    }
    if (!member.passwordHash) {
      return NextResponse.json(
        { error: 'No password set. Please accept your invitation first.' },
        { status: 403 },
      );
    }

    const passwordMatch = await bcrypt.compare(password, member.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const sessionToken = crypto.randomUUID();
    const { error: sessionError } = await createSession({
      token: sessionToken,
      teamMemberId: member.id,
      expiresAt: computeNewExpiry(),
      ipAddress,
    });

    if (sessionError) {
      return NextResponse.json({ error: 'Failed to create session.' }, { status: 500 });
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        initials: member.initials,
      },
    });
    setAuthCookie(response, sessionToken);
    return response;
  }

  // -------------------------------------------------------------------------
  // 2. Fallback to admins table
  // -------------------------------------------------------------------------
  const db = createSupabaseAdminClient();
  const { data: adminData, error: adminError } = await db
    .from('admins')
    .select('id, email, name, role, initials, password_hash')
    .eq('email', email)
    .single();

  if (adminError || !adminData) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const admin = adminData as unknown as AdminRow;
  const passwordMatch = await bcrypt.compare(password, admin.password_hash);
  if (!passwordMatch) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  }

  const sessionToken = crypto.randomUUID();
  const { error: sessionError } = await createSession({
    token: sessionToken,
    adminId: admin.id,
    expiresAt: computeNewExpiry(),
    ipAddress,
  });

  if (sessionError) {
    return NextResponse.json({ error: 'Failed to create session.' }, { status: 500 });
  }

  const response = NextResponse.json({
    success: true,
    user: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role as RoleName,
      initials: admin.initials ?? '',
    },
  });
  setAuthCookie(response, sessionToken);
  return response;
}
