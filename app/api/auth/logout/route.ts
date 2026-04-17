import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { deleteSessionByToken } from '@/lib/db/auth';
import { clearAuthCookie } from '@/lib/auth/api-helpers';
import { AUTH_CONFIG } from '@/constants/auth';

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.SESSION_COOKIE_NAME)?.value;

  if (token) {
    // Best-effort — don't fail if the session is already gone
    await deleteSessionByToken(token);
  }

  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
