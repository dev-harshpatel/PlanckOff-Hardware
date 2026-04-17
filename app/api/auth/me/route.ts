import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';

export const GET = withAuth(async (_request: NextRequest, { user, teamMember }: AuthContext) => {
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      initials: user.initials,
      isAdmin: user.isAdmin,
    },
    teamMember: teamMember
      ? {
          id: teamMember.id,
          status: teamMember.status,
          roleId: teamMember.roleId,
        }
      : null,
  });
});
