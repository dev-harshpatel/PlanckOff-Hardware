import type { RoleName } from '@/types/auth';

export const ROLE_LEVELS: Record<RoleName, number> = {
  Administrator: 1,
  'Team Lead': 2,
  Estimator: 3,
  Client: 4,
} as const;

export function isRoleName(value: string | null | undefined): value is RoleName {
  return !!value && value in ROLE_LEVELS;
}

/**
 * Administrator can invite anyone (Administrator, Team Lead, Estimator, Client).
 * Team Lead can invite Estimator or Client.
 * Estimator (and Client) cannot invite anyone.
 */
export function canInviteRole(inviterRole: RoleName, inviteeRole: RoleName): boolean {
  if (inviterRole === 'Administrator') return true;
  if (inviterRole === 'Team Lead') return inviteeRole === 'Estimator' || inviteeRole === 'Client';
  return false;
}

export function getInvitableRoles(userRole: RoleName): RoleName[] {
  if (userRole === 'Administrator') return ['Administrator', 'Team Lead', 'Estimator', 'Client'];
  if (userRole === 'Team Lead') return ['Estimator', 'Client'];
  return [];
}
