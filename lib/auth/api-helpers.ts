import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { hasRoleAccess } from '@/lib/auth/rbac';
import { AUTH_CONFIG, COOKIE_CONFIG } from '@/constants/auth';
import { isClientAssignedToProject } from '@/lib/db/clientProjectAssignments';
import { isEstimatorAssignedToProject } from '@/lib/db/projects';
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

/**
 * Wraps a handler that operates on a specific project. Enforces:
 *  - Clients can only access projects in `client_project_assignments` (D-01, D-02)
 *  - Clients are blocked from all non-GET methods on project sub-routes (D-03)
 *  - Non-Client roles (Estimator, Team Lead, Administrator) retain org-wide access (D-02)
 *
 * Uses 404 (not 403) for both "not assigned" and "missing projectId" Client paths
 * to avoid leaking project existence to unauthorised Clients.
 */
export function withProjectAuth(handler: AuthenticatedHandler) {
  return async (request: NextRequest, routeContext?: { params?: Promise<RouteParams> | RouteParams }) => {
    const session = await validateSession();

    if (!session.isValid || !session.user) {
      return NextResponse.json(
        { error: session.error ?? 'Unauthorized' },
        { status: session.statusCode },
      );
    }

    const params = routeContext?.params ? await routeContext.params : undefined;
    const projectId = params?.id as string | undefined;
    const user = session.user;

    // D-03: Block Client write operations on all project sub-routes
    if (user.role === 'Client' && request.method !== 'GET') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // D-01/D-02: Scope Client reads to assigned projects (404 not 403 — RESEARCH Pitfall 2)
    if (user.role === 'Client') {
      if (!projectId) {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      }
      const allowed = await isClientAssignedToProject(user.id, projectId);
      if (!allowed) {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      }
    }

    // Scope Estimator access to projects they are assigned to (same 404 pattern)
    if (user.role === 'Estimator') {
      if (!projectId) {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      }
      const allowed = await isEstimatorAssignedToProject(user.id, projectId);
      if (!allowed) {
        return NextResponse.json({ error: 'Not found.' }, { status: 404 });
      }
    }

    const response = await handler(
      request,
      { user, teamMember: session.teamMember },
      params,
    );

    if (session.shouldRefreshCookie && session.sessionToken) {
      setAuthCookie(response, session.sessionToken);
    }

    return response;
  };
}
