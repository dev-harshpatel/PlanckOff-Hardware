import { NextRequest, NextResponse } from 'next/server';
import { resolveSessionFromToken } from '@/lib/auth/sessionResolver';
import { canAccessRoute } from '@/lib/auth/rbac';
import { AUTH_CONFIG } from '@/constants/auth';
import type { RoleName } from '@/types/auth';

// ---------------------------------------------------------------------------
// Public path prefixes — never require auth
// ---------------------------------------------------------------------------
const PUBLIC_PREFIXES = [
  '/login',
  '/set-password',
  '/api/auth/',
  '/api/team/invite/',       // GET validate token
  '/api/team/set-password',  // POST accept invite
  '/_next/',
  '/favicon',
  '/icons/',
  '/images/',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Read session token from cookie
  const token = request.cookies.get(AUTH_CONFIG.SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  // Resolve session (lightweight — no renewal in middleware for performance)
  const resolved = await resolveSessionFromToken(token, {
    cleanupExpired: false,
    renewIfExpiring: false,
  });

  if (!resolved) {
    return redirectToLogin(request);
  }

  // Check route-level role access
  const isApi = pathname.startsWith('/api/');
  const { allowed } = canAccessRoute(resolved.user.role as RoleName, pathname, isApi);

  if (!allowed) {
    if (isApi) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    // Redirect to dashboard with error param
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('error', 'access_denied');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('redirectTo', request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

// ---------------------------------------------------------------------------
// Matcher — run on all routes except static assets
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
