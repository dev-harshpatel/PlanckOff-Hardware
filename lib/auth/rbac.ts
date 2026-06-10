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
  { path: '/',               minRole: 'Client',    description: 'Dashboard (Client read-only access)' },
  { path: '/project',        minRole: 'Client',    description: 'Project workspace (Client read-only access)' },
  { path: '/database',       allowedRoles: ['Administrator', 'Team Lead'], description: 'Hardware database (Administrator / Team Lead only)' },
  { path: '/api/auth/me',    minRole: 'Client',    description: 'Current user info (all authenticated users)' },
  { path: '/api/ai',         minRole: 'Estimator', description: 'AI generation routes' },
  { path: '/api/export',     minRole: 'Client',    description: 'Export routes' },

  // Projects API — Client can list/view their assigned projects.
  // /api/projects/trash is listed explicitly so the longer-prefix rule blocks Client
  // from accessing it even though /api/projects matches as a shorter prefix.
  { path: '/api/projects',       minRole: 'Client',                            description: 'Projects list and workspace (scoped in handler for Client)' },
  { path: '/api/projects/trash', allowedRoles: ['Administrator', 'Team Lead'], description: 'Project trash (Admin/Team Lead only)' },

  // Master hardware catalogue — GET open to all authenticated; mutations restricted
  { path: '/api/master-hardware/pending/review', allowedRoles: ['Administrator', 'Team Lead'], description: 'Approve/reject pending hardware (Admin/Team Lead only)' },
  { path: '/api/master-hardware',                allowedRoles: ['Administrator', 'Team Lead'], description: 'Master hardware API (Administrator / Team Lead only)' },

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
