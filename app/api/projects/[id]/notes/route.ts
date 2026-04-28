import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getProjectNotes, upsertProjectNotes } from '@/lib/db/notes';
import type { NoteTab } from '@/types';

const VALID_TABS: NoteTab[] = ['hardware', 'door', 'frame'];

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    const { data, error } = await getProjectNotes(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const PUT = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const id = params?.id as string;
    let body: { tab: NoteTab; content: Record<string, unknown> | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { tab, content } = body;
    if (!VALID_TABS.includes(tab)) {
      return NextResponse.json({ error: `Invalid tab. Must be one of: ${VALID_TABS.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await upsertProjectNotes(id, tab, content);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);
