import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTeamMemberById } from '@/lib/db/team';
import { getProjectsForClient } from '@/lib/db/projects';
import { getProjectsForEstimator } from '@/lib/db/projects';

export const GET = withRoleAuth(
  ['Administrator'],
  async (_request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const memberId = params?.id as string;
    if (!memberId) return NextResponse.json({ error: 'Missing member id.' }, { status: 400 });

    const { data: member, error: memberErr } = await getTeamMemberById(memberId);
    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    if (member.role === 'Client') {
      const { data, error } = await getProjectsForClient(memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data ?? [] });
    }

    if (member.role === 'Estimator') {
      const { data, error } = await getProjectsForEstimator(memberId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data ?? [] });
    }

    // Admins and Team Leads have org-wide access — no assignment list
    return NextResponse.json({ data: [] });
  },
);
