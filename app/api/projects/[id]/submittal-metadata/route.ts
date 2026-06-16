import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getSubmittalMeta, upsertSubmittalMeta } from '@/lib/db/submittalMetadata';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getSubmittalMeta(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const body = await req.json().catch(() => ({}));
    const { fromName, toName, gcName, projectAddress, projectName, companyName } = body as Record<string, string>;

    const { error } = await upsertSubmittalMeta(projectId, {
      fromName:       fromName       ?? '',
      toName:         toName         ?? '',
      gcName:         gcName         ?? '',
      projectAddress: projectAddress ?? '',
      projectName:    projectName    ?? '',
      companyName:    companyName    ?? '',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  },
);
