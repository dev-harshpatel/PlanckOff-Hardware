import type { RoleName } from '@/types/auth';

export type { RoleName };

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  roleId: string;
  status: 'Active' | 'Invited';
  initials: string;
  invitedBy: string | null;
  inviteToken: string | null;
  inviteExpiresAt: string | null;
  createdAt: string;
}

export interface TeamMemberWithRole extends TeamMember {
  role: RoleName;
}
