import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { addProjectToClient, removeProjectFromClient } from '@/lib/db/clientProjectAssignments';
import { getProjectById, updateProject } from '@/lib/db/projects';
import type { ProjectStatus } from '@/types';
import { getTeamMemberById } from '@/lib/db/team';
import { invalidateProjects } from '@/lib/cache/projects';

export const POST = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (request: NextRequest, { user }: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    if (!projectId) return NextResponse.json({ error: 'Missing project id.' }, { status: 400 });

    let body: { clientId: string };
    try {
      body = (await request.json()) as { clientId: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!body.clientId) {
      return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });
    }

    const assignedById = user.isAdmin ? null : user.id;

    // Add client assignment
    const { error: assignErr } = await addProjectToClient(body.clientId, projectId, assignedById);
    if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 });

    // Only clear the assignee if they are an Estimator; keep Admin / Team Lead assigned
    const { data: currentProject } = await getProjectById(projectId);
    const projectUpdate: { status: ProjectStatus; assignedTo?: string } = { status: 'Client' };
    if (currentProject?.assignedTo) {
      const { data: assignedMember } = await getTeamMemberById(currentProject.assignedTo);
      if (assignedMember?.role === 'Estimator') {
        projectUpdate.assignedTo = '';
      }
    }

    const { error: updateErr } = await updateProject(projectId, projectUpdate);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    await invalidateProjects();

    return NextResponse.json({ success: true, status: 'Client' });
  },
);

export const DELETE = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    if (!projectId) return NextResponse.json({ error: 'Missing project id.' }, { status: 400 });

    let body: { clientId: string };
    try {
      body = (await request.json()) as { clientId: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!body.clientId) {
      return NextResponse.json({ error: 'clientId is required.' }, { status: 400 });
    }

    const { error } = await removeProjectFromClient(body.clientId, projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await invalidateProjects();

    return NextResponse.json({ success: true });
  },
);
