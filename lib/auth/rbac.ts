import type { RoleName } from '@/types/auth';
import { ROLE_LEVELS } from '@/constants/roles';

// ---------------------------------------------------------------------------
// Core checks
// ---------------------------------------------------------------------------

export function hasRoleAccess(userRole: RoleName, allowedRoles: RoleName[]): boolean {
  return allowedRoles.includes(userRole);
}

export function meetsMinRoleRequirement(userRole: RoleName, minRole: RoleName): boolean {
  return ROLE_LEVELS[userRole] <= ROLE_LEVELS[minRole];
}

// ---------------------------------------------------------------------------
// Route permissions table
// ---------------------------------------------------------------------------

interface RoutePermission {
  path: string;
  /** If set, user role must be in this list. */
  allowedRoles?: RoleName[];
  /** If set, user role level must be ≤ this role's level. */
  minRole?: RoleName;
  /** Public routes require no authentication. */
  public?: boolean;
  description: string;
}

export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // Public
  { path: '/login',                  public: true,  description: 'Login page' },
  { path: '/set-password',           public: true,  description: 'Accept invite / set password' },
  { path: '/api/auth/login',         public: true,  description: 'Login API' },
  { path: '/api/auth/logout',        public: true,  description: 'Logout API' },
  { path: '/api/team/invite/',       public: true,  description: 'Validate invite token (GET)' },
  { path: '/api/team/set-password',  public: true,  description: 'Set password after invite' },

  // Authenticated — all roles
  { path: '/',               minRole: 'Estimator', description: 'Dashboard' },
  { path: '/project',        minRole: 'Estimator', description: 'Project workspace' },
  { path: '/database',       minRole: 'Estimator', description: 'Hardware database' },
  { path: '/api/auth/me',    minRole: 'Estimator', description: 'Current user info' },
  { path: '/api/ai',         minRole: 'Estimator', description: 'AI generation routes' },
  { path: '/api/export',     minRole: 'Estimator', description: 'Export routes' },

  // Team management — Administrator + Team Lead
  { path: '/team',              allowedRoles: ['Administrator', 'Team Lead'], description: 'Team management page' },
  { path: '/api/team/members',  allowedRoles: ['Administrator', 'Team Lead'], description: 'Team members CRUD' },
  { path: '/api/team/invite',   allowedRoles: ['Administrator', 'Team Lead'], description: 'Invite a user' },
];

// ---------------------------------------------------------------------------
// Route lookup
// ---------------------------------------------------------------------------

export function getRoutePermission(path: string, isApi = false): RoutePermission | null {
  const normPath = path.split('?')[0]; // strip query string

  // 1. Exact match
  const exact = ROUTE_PERMISSIONS.find((r) => r.path === normPath);
  if (exact) return exact;

  // 2. Prefix match (longest wins)
  const prefixMatches = ROUTE_PERMISSIONS.filter(
    (r) => normPath.startsWith(r.path) && r.path !== '/',
  ).sort((a, b) => b.path.length - a.path.length);

  if (prefixMatches.length > 0) return prefixMatches[0];

  // 3. API routes default to authenticated
  if (isApi) {
    return { path: normPath, minRole: 'Estimator', description: 'Default API (authenticated)' };
  }

  // 4. Page routes default to authenticated
  return { path: normPath, minRole: 'Estimator', description: 'Default page (authenticated)' };
}

// ---------------------------------------------------------------------------
// Access decision
// ---------------------------------------------------------------------------

interface AccessDecision {
  allowed: boolean;
  reason: string;
}

export function canAccessRoute(
  userRole: RoleName | null,
  path: string,
  isApi = false,
): AccessDecision {
  const permission = getRoutePermission(path, isApi);

  if (!permission) {
    return { allowed: true, reason: 'No permission rule — allow by default' };
  }

  if (permission.public) {
    return { allowed: true, reason: 'Public route' };
  }

  if (!userRole) {
    return { allowed: false, reason: 'Unauthenticated' };
  }

  if (permission.allowedRoles) {
    const ok = hasRoleAccess(userRole, permission.allowedRoles);
    return {
      allowed: ok,
      reason: ok ? 'Role in allowed list' : `Role "${userRole}" not in allowed list`,
    };
  }

  if (permission.minRole) {
    const ok = meetsMinRoleRequirement(userRole, permission.minRole);
    return {
      allowed: ok,
      reason: ok ? 'Meets minimum role' : `Role "${userRole}" below minimum "${permission.minRole}"`,
    };
  }

  return { allowed: true, reason: 'No role constraint' };
}
