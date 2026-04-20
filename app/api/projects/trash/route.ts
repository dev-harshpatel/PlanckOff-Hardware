import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext } from '@/lib/auth/api-helpers';
import { cleanupExpiredProjects, getTrashedProjects } from '@/lib/db/projects';

// GET /api/projects/trash — returns all soft-deleted projects (not yet expired)
// Also runs the 30-day cleanup before responding so expired projects are gone.
export const GET = withAuth(async (_req, _ctx: AuthContext) => {
  // Purge any rows older than 30 days first
  await cleanupExpiredProjects();

  const { data, error } = await getTrashedProjects();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
});
