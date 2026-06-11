import { NextRequest, NextResponse } from 'next/server';
import { withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { addProjectToClient } from '@/lib/db/clientProjectAssignments';

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
    const { error } = await addProjectToClient(body.clientId, projectId, assignedById);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  },
);
