import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { createProject, getProjectsForClient } from '@/lib/db/projects';
import { getCachedProjects, invalidateProjects } from '@/lib/cache/projects';
import type { NewProjectData } from '@/types';

export const GET = withAuth(async (_req: NextRequest, { user }: AuthContext) => {
  if (user.role === 'Client') {
    // Client users see only their assigned projects — bypass the global cache
    // since the result set is per-user.
    const { data, error } = await getProjectsForClient(user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  const { data, error } = await getCachedProjects();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});

export const POST = withRoleAuth(['Administrator', 'Team Lead'], async (req: NextRequest, { user }: AuthContext) => {
  let body: NewProjectData;
  try {
    body = (await req.json()) as NewProjectData;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
  }

  const { data, error } = await createProject({ ...body, createdBy: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateProjects();
  return NextResponse.json({ data }, { status: 201 });
});
