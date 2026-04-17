import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { hasRoleAccess } from '@/lib/auth/rbac';
import { AUTH_CONFIG, COOKIE_CONFIG } from '@/constants/auth';
import type { AuthUser } from '@/types/auth';
import type { TeamMemberWithRole } from '@/types/team';
import type { RoleName } from '@/types/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContext {
  user: AuthUser;
  teamMember: TeamMemberWithRole | null;
}

export type RouteParams = Record<string, string | string[]>;

export type AuthenticatedHandler = (
  request: NextRequest,
  context: AuthContext,
  params?: RouteParams,
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// Cookie helper
// ---------------------------------------------------------------------------

export function setAuthCookie(response: NextResponse, token: string): void {
  const expires = new Date();
  expires.setDate(expires.getDate() + AUTH_CONFIG.SESSION_DURATION_DAYS);

  response.cookies.set(AUTH_CONFIG.SESSION_COOKIE_NAME, token, {
    ...COOKIE_CONFIG,
    expires,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_CONFIG.SESSION_COOKIE_NAME, '', {
    ...COOKIE_CONFIG,
    maxAge: 0,
  });
}

// ---------------------------------------------------------------------------
// Higher-order functions
// ---------------------------------------------------------------------------

/**
 * Wraps a handler requiring any authenticated user.
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, routeContext?: { params?: Promise<RouteParams> | RouteParams }) => {
    const session = await validateSession();

    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: session.error ?? 'Unauthorized' },
        { status: session.statusCode },
      );
    }

    const params = routeContext?.params ? await routeContext.params : undefined;

    const response = await handler(
      request,
      { user: session.user, teamMember: session.teamMember },
      params,
    );

    if (session.shouldRefreshCookie && session.sessionToken) {
      setAuthCookie(response, session.sessionToken);
    }

    return response;
  };
}

/**
 * Wraps a handler requiring specific roles.
 */
export function withRoleAuth(allowedRoles: RoleName[], handler: AuthenticatedHandler) {
  return async (request: NextRequest, routeContext?: { params?: Promise<RouteParams> | RouteParams }) => {
    const session = await validateSession();

    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: session.error ?? 'Unauthorized' },
        { status: session.statusCode },
      );
    }

    if (!hasRoleAccess(session.user.role, allowedRoles)) {
      return NextResponse.json(
        { error: 'Forbidden — insufficient role.' },
        { status: 403 },
      );
    }

    const params = routeContext?.params ? await routeContext.params : undefined;

    const response = await handler(
      request,
      { user: session.user, teamMember: session.teamMember },
      params,
    );

    if (session.shouldRefreshCookie && session.sessionToken) {
      setAuthCookie(response, session.sessionToken);
    }

    return response;
  };
}
