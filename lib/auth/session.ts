import { cookies } from 'next/headers';
import { resolveSessionFromToken } from '@/lib/auth/sessionResolver';
import { AUTH_CONFIG } from '@/constants/auth';
import type { AuthUser } from '@/types/auth';
import type { TeamMemberWithRole } from '@/types/team';

export interface SessionValidationResult {
  isValid: boolean;
  user: AuthUser | null;
  teamMember: TeamMemberWithRole | null;
  error: string | null;
  statusCode: number;
  sessionToken: string | null;
  shouldRefreshCookie: boolean;
}

/**
 * Full session validation — reads cookie, resolves session, loads teamMember.
 * Use in API routes and server components.
 */
export async function validateSession(): Promise<SessionValidationResult> {
  const invalid = (error: string, statusCode = 401): SessionValidationResult => ({
    isValid: false,
    user: null,
    teamMember: null,
    error,
    statusCode,
    sessionToken: null,
    shouldRefreshCookie: false,
  });

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.SESSION_COOKIE_NAME)?.value;

  if (!token) return invalid('No session cookie.');

  const resolved = await resolveSessionFromToken(token, {
    cleanupExpired: true,
    renewIfExpiring: true,
  });

  if (!resolved) return invalid('Session invalid or expired.');

  return {
    isValid: true,
    user: resolved.user,
    teamMember: resolved.teamMember,
    error: null,
    statusCode: 200,
    sessionToken: resolved.session.token,
    shouldRefreshCookie: resolved.renewed,
  };
}

/**
 * Quick session check — same as validateSession but does NOT load teamMember data.
 * Faster for middleware checks.
 */
export async function quickSessionCheck(): Promise<
  Pick<SessionValidationResult, 'isValid' | 'user' | 'error' | 'statusCode' | 'sessionToken' | 'shouldRefreshCookie'>
> {
  const invalid = (error: string, statusCode = 401) => ({
    isValid: false,
    user: null as AuthUser | null,
    error,
    statusCode,
    sessionToken: null,
    shouldRefreshCookie: false,
  });

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_CONFIG.SESSION_COOKIE_NAME)?.value;

  if (!token) return invalid('No session cookie.');

  const resolved = await resolveSessionFromToken(token, {
    cleanupExpired: false,
    renewIfExpiring: false,
  });

  if (!resolved) return invalid('Session invalid or expired.');

  return {
    isValid: true,
    user: resolved.user,
    error: null,
    statusCode: 200,
    sessionToken: resolved.session.token,
    shouldRefreshCookie: false,
  };
}
