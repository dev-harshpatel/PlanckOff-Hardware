import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRoleAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import {
  getProjectById,
  updateProject,
  softDeleteProject,
  hardDeleteProject,
  restoreProject,
} from '@/lib/db/projects';
import type { Project } from '@/types';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    const { data, error } = await getProjectById(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    let updates: Partial<Project>;
    try {
      updates = (await req.json()) as Partial<Project>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { data, error } = await updateProject(id, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const DELETE = withRoleAuth(
  ['Administrator', 'Team Lead'],
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    const { searchParams } = new URL(req.url);

    // ?hard=true for permanent delete, ?restore=true to restore from trash
    if (searchParams.get('restore') === 'true') {
      const { error } = await restoreProject(id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: 'restored' });
    }

    if (searchParams.get('hard') === 'true') {
      const { error } = await hardDeleteProject(id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, action: 'permanently_deleted' });
    }

    // Default: soft delete
    const { error } = await softDeleteProject(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: 'trashed' });
  },
);
