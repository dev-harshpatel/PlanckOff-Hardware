/**
 * POST /api/projects/[id]/process/upload-url
 *
 * Issues a signed Supabase Storage upload URL for a temporary hardware PDF.
 * This app uses its own session-cookie auth, not Supabase Auth, so the
 * browser's Supabase client has no real "authenticated" role — RLS policies
 * on storage.objects can never pass for it. A signed upload URL sidesteps
 * RLS entirely: it's generated here (behind withProjectAuth, which already
 * validates the user's session and project access) using the service-role
 * key, and the resulting token is the sole credential the browser needs to
 * upload to that exact path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const POST = withProjectAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const storagePath = `temp/${projectId}/${crypto.randomUUID()}.pdf`;

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient.storage
      .from('temp-pdf-uploads')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      return NextResponse.json(
        { error: 'Could not prepare a storage upload slot. Please try again.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: { path: data.path, token: data.token },
    });
  },
);

/**
 * DELETE /api/projects/[id]/process/upload-url
 * Body: { path: string }
 *
 * Client-side cleanup for when a large-PDF upload was cancelled or processing
 * failed before the main /process route's own cleanup could run. Gated by
 * withProjectAuth and scoped to this project's temp prefix so a caller can't
 * delete another project's file.
 */
export const DELETE = withProjectAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let body: { path?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const storagePath = body.path;
    if (!storagePath || !storagePath.startsWith(`temp/${projectId}/`)) {
      return NextResponse.json({ error: 'Invalid or missing path.' }, { status: 400 });
    }

    const adminClient = createSupabaseAdminClient();
    await adminClient.storage.from('temp-pdf-uploads').remove([storagePath]);

    return NextResponse.json({ data: { ok: true } });
  },
);
