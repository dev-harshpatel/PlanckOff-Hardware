'use client';

import { useAuth } from '@/contexts/AuthContext';
import { hasRoleAccess, meetsMinRoleRequirement, canAccessRoute } from '@/lib/auth/rbac';
import { canInviteRole } from '@/constants/roles';
import type { RoleName } from '@/types/auth';

export function useRBAC() {
  const { user } = useAuth();
  const userRole = user?.role ?? null;

  return {
    userRole,

    hasRole: (role: RoleName): boolean =>
      userRole !== null && userRole === role,

    hasAnyRole: (roles: RoleName[]): boolean =>
      userRole !== null && hasRoleAccess(userRole, roles),

    hasMinRole: (minRole: RoleName): boolean =>
      userRole !== null && meetsMinRoleRequirement(userRole, minRole),

    canAccess: (path: string): boolean =>
      canAccessRoute(userRole, path).allowed,

    isAdmin: userRole === 'Administrator',
    isTeamLead: userRole === 'Team Lead',
    isEstimator: userRole === 'Estimator',
    isTeamLeadOrHigher: userRole !== null && meetsMinRoleRequirement(userRole, 'Team Lead'),

    canManageTeam:
      userRole !== null && hasRoleAccess(userRole, ['Administrator', 'Team Lead']),

    canInviteUsers:
      userRole !== null && hasRoleAccess(userRole, ['Administrator', 'Team Lead']),
  };
}

/**
 * Returns true if the current user has at least one of the allowed roles.
 */
export function usePermission(allowedRoles: RoleName[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasRoleAccess(user.role, allowedRoles);
}

/**
 * Returns true if the current user meets the minimum role requirement.
 */
export function useMinRole(minRole: RoleName): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return meetsMinRoleRequirement(user.role, minRole);
}
