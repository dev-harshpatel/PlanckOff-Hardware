// RoleName lives here — imported by types/team.ts to avoid circular deps.
export type RoleName = 'Administrator' | 'Team Lead' | 'Estimator';

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  initials: string;
}

/**
 * Unified user object returned from session validation.
 * Normalises both admins and team_members into one shape.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: RoleName;
  initials: string;
  /** true when the record came from the admins table */
  isAdmin: boolean;
}
