import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getTeamMemberById } from '@/lib/db/team';
import { removeProjectFromClient } from '@/lib/db/clientProjectAssignments';
import { updateProject } from '@/lib/db/projects';
import { invalidateProjects } from '@/lib/cache/projects';

export const DELETE = withRoleAuth(
  ['Administrator'],
  async (_request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const memberId  = params?.id as string;
    const projectId = params?.projectId as string;
    if (!memberId || !projectId) {
      return NextResponse.json({ error: 'Missing id or projectId.' }, { status: 400 });
    }

    const { data: member, error: memberErr } = await getTeamMemberById(memberId);
    if (memberErr || !member) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }

    if (member.role === 'Client') {
      const { error } = await removeProjectFromClient(memberId, projectId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (member.role === 'Estimator') {
      const { error } = await updateProject(projectId, { assignedTo: '' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      await invalidateProjects();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unassignment not applicable for this role.' }, { status: 400 });
  },
);
