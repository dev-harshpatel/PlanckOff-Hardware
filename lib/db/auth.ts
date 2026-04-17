import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AuthUser, RoleName } from '@/types/auth';
import type { TeamMemberWithRole } from '@/types/team';
import { AUTH_CONFIG } from '@/constants/auth';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case from Postgres)
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  token: string;
  admin_id: string | null;
  team_member_id: string | null;
  expires_at: string;
  ip_address: string | null;
  created_at: string;
  admins: AdminRow | null;
  team_members: TeamMemberRow | null;
}

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string | null;
}

interface TeamMemberRow {
  id: string;
  email: string;
  name: string;
  initials: string | null;
  status: string;
  role_id: string;
  invited_by: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  created_at: string;
  roles: { name: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toAuthUserFromAdmin(row: AdminRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as RoleName,
    initials: row.initials ?? '',
    isAdmin: true,
  };
}

function toTeamMemberWithRole(row: TeamMemberRow): TeamMemberWithRole {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleId: row.role_id,
    role: (row.roles?.name ?? 'Estimator') as RoleName,
    status: row.status as 'Active' | 'Invited',
    initials: row.initials ?? '',
    invitedBy: row.invited_by,
    inviteToken: row.invite_token,
    inviteExpiresAt: row.invite_expires_at,
    createdAt: row.created_at,
  };
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Look up a session by token, joining admin and team_member+role rows.
 */
export async function findSessionByToken(
  token: string,
): Promise<DbResult<{ session: SessionRow; user: AuthUser; teamMember: TeamMemberWithRole | null }>> {
  try {
    const db = createSupabaseAdminClient();

    const { data, error } = await db
      .from('auth_sessions')
      .select(`
        id, token, admin_id, team_member_id, expires_at, ip_address, created_at,
        admins ( id, email, name, role, initials ),
        team_members (
          id, email, name, initials, status, role_id,
          invited_by, invite_token, invite_expires_at, created_at,
          roles ( name )
        )
      `)
      .eq('token', token)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    if (!data) return { data: null, error: { message: 'Session not found.' } };

    const row = data as unknown as SessionRow;

    let user: AuthUser;
    let teamMember: TeamMemberWithRole | null = null;

    if (row.admins) {
      user = toAuthUserFromAdmin(row.admins);
    } else if (row.team_members) {
      const tm = toTeamMemberWithRole(row.team_members);
      teamMember = tm;
      user = {
        id: tm.id,
        email: tm.email,
        name: tm.name,
        role: tm.role,
        initials: tm.initials,
        isAdmin: false,
      };
    } else {
      return { data: null, error: { message: 'Session has no associated user.' } };
    }

    return { data: { session: row, user, teamMember }, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function createSession(input: {
  token: string;
  adminId?: string;
  teamMemberId?: string;
  expiresAt: string;
  ipAddress?: string;
}): Promise<DbResult<{ id: string }>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('auth_sessions')
      .insert({
        token: input.token,
        admin_id: input.adminId ?? null,
        team_member_id: input.teamMemberId ?? null,
        expires_at: input.expiresAt,
        ip_address: input.ipAddress ?? null,
      })
      .select('id')
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data as { id: string }, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function deleteSessionById(id: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('auth_sessions').delete().eq('id', id);
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function deleteSessionByToken(token: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('auth_sessions').delete().eq('token', token);
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

export async function updateSessionExpiry(input: {
  sessionId: string;
  expiresAt: string;
}): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db
      .from('auth_sessions')
      .update({ expires_at: input.expiresAt })
      .eq('id', input.sessionId);
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/** Clean up all expired sessions (called opportunistically on each validateSession). */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    await db.from('auth_sessions').delete().lt('expires_at', new Date().toISOString());
  } catch {
    // Non-critical — silently ignore
  }
}

/**
 * Compute a renewed expiry timestamp based on SESSION_DURATION_DAYS.
 */
export function computeNewExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + AUTH_CONFIG.SESSION_DURATION_DAYS);
  return d.toISOString();
}
