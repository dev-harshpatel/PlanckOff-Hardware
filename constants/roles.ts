import type { RoleName } from '@/types/auth';

export const ROLE_LEVELS: Record<RoleName, number> = {
  Administrator: 1,
  'Team Lead': 2,
  Estimator: 3,
} as const;

export function isRoleName(value: string | null | undefined): value is RoleName {
  return !!value && value in ROLE_LEVELS;
}

/**
 * Administrator can invite anyone.
 * Team Lead can only invite Estimators.
 * Estimator cannot invite anyone.
 */
export function canInviteRole(inviterRole: RoleName, inviteeRole: RoleName): boolean {
  if (inviterRole === 'Administrator') return true;
  if (inviterRole === 'Team Lead') return inviteeRole === 'Estimator';
  return false;
}

export function getInvitableRoles(userRole: RoleName): RoleName[] {
  if (userRole === 'Administrator') return ['Administrator', 'Team Lead', 'Estimator'];
  if (userRole === 'Team Lead') return ['Estimator'];
  return [];
}
