import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { RoleName } from '@/types/auth';
import type { TeamMember, TeamMemberWithRole } from '@/types/team';

// ---------------------------------------------------------------------------
// Raw DB row shapes
// ---------------------------------------------------------------------------

interface TeamMemberRow {
  id: string;
  email: string;
  password_hash: string | null;
  name: string;
  role_id: string;
  status: string;
  initials: string | null;
  invited_by: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  created_at: string;
  roles?: { name: string } | null;
}

// ---------------------------------------------------------------------------
// Transformers
// ---------------------------------------------------------------------------

function toTeamMember(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roleId: row.role_id,
    status: row.status as 'Active' | 'Invited',
    initials: row.initials ?? '',
    invitedBy: row.invited_by,
    inviteToken: row.invite_token,
    inviteExpiresAt: row.invite_expires_at,
    createdAt: row.created_at,
  };
}

function toTeamMemberWithRole(row: TeamMemberRow): TeamMemberWithRole {
  return {
    ...toTeamMember(row),
    role: (row.roles?.name ?? 'Estimator') as RoleName,
  };
}

function toDbRow(
  input: Partial<{
    email: string;
    passwordHash: string;
    name: string;
    roleId: string;
    status: string;
    initials: string;
    invitedBy: string | null;
    inviteToken: string | null;
    inviteExpiresAt: string | null;
  }>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.email !== undefined) row.email = input.email;
  if (input.passwordHash !== undefined) row.password_hash = input.passwordHash;
  if (input.name !== undefined) row.name = input.name;
  if (input.roleId !== undefined) row.role_id = input.roleId;
  if (input.status !== undefined) row.status = input.status;
  if (input.initials !== undefined) row.initials = input.initials;
  if (input.invitedBy !== undefined) row.invited_by = input.invitedBy;
  if (input.inviteToken !== undefined) row.invite_token = input.inviteToken;
  if (input.inviteExpiresAt !== undefined) row.invite_expires_at = input.inviteExpiresAt;
  return row;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

const MEMBER_WITH_ROLE_SELECT = `
  id, email, name, role_id, status, initials,
  invited_by, invite_token, invite_expires_at, created_at,
  roles ( name )
`;

export async function getAllTeamMembers(): Promise<DbResult<TeamMemberWithRole[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('team_members')
      .select(MEMBER_WITH_ROLE_SELECT)
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: { message: error.message } };
    return {
      data: (data as unknown as TeamMemberRow[]).map(toTeamMemberWithRole),
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getTeamMemberById(id: string): Promise<DbResult<TeamMemberWithRole>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('team_members')
      .select(MEMBER_WITH_ROLE_SELECT)
      .eq('id', id)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toTeamMemberWithRole(data as unknown as TeamMemberRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getTeamMemberByEmail(email: string): Promise<DbResult<TeamMemberWithRole & { passwordHash: string | null }>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('team_members')
      .select(`${MEMBER_WITH_ROLE_SELECT}, password_hash`)
      .eq('email', email)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    const row = data as unknown as TeamMemberRow;
    return {
      data: {
        ...toTeamMemberWithRole(row),
        passwordHash: row.password_hash,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getTeamMemberByInviteToken(token: string): Promise<DbResult<TeamMemberWithRole>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('team_members')
      .select(MEMBER_WITH_ROLE_SELECT)
      .eq('invite_token', token)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toTeamMemberWithRole(data as unknown as TeamMemberRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function createTeamMember(input: {
  email: string;
  name: string;
  roleId: string;
  initials?: string;
  invitedBy?: string;
  inviteToken?: string;
  inviteExpiresAt?: string;
  status?: string;
}): Promise<DbResult<TeamMember>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('team_members')
      .insert({
        email: input.email,
        name: input.name,
        role_id: input.roleId,
        initials: input.initials ?? input.name.slice(0, 2).toUpperCase(),
        invited_by: input.invitedBy ?? null,
        invite_token: input.inviteToken ?? null,
        invite_expires_at: input.inviteExpiresAt ?? null,
        status: input.status ?? 'Invited',
      })
      .select('id, email, name, role_id, status, initials, invited_by, invite_token, invite_expires_at, created_at')
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toTeamMember(data as unknown as TeamMemberRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function updateTeamMember(
  id: string,
  updates: Partial<{
    email: string;
    passwordHash: string;
    name: string;
    roleId: string;
    status: string;
    initials: string;
    invitedBy: string | null;
    inviteToken: string | null;
    inviteExpiresAt: string | null;
  }>,
): Promise<DbResult<TeamMember>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('team_members')
      .update(toDbRow(updates))
      .eq('id', id)
      .select('id, email, name, role_id, status, initials, invited_by, invite_token, invite_expires_at, created_at')
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toTeamMember(data as unknown as TeamMemberRow), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function deleteTeamMember(id: string): Promise<DbResult<boolean>> {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.from('team_members').delete().eq('id', id);
    if (error) return { data: null, error: { message: error.message } };
    return { data: true, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/** Unified member shape for UI display (admins + team_members). */
export interface UnifiedMember {
  id: string;
  email: string;
  name: string;
  initials: string;
  role: RoleName;
  status: 'Active' | 'Invited';
  source: 'admin' | 'team_member';
  inviteExpiresAt: string | null;
}

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: string;
  initials: string | null;
}

/** Fetch all admins and return them in unified shape. */
export async function getAllAdmins(): Promise<DbResult<UnifiedMember[]>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('admins')
      .select('id, email, name, role, initials')
      .order('created_at', { ascending: true });

    if (error) return { data: null, error: { message: error.message } };

    const admins = (data as unknown as AdminRow[]).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      initials: row.initials ?? row.name.slice(0, 2).toUpperCase(),
      role: row.role as RoleName,
      status: 'Active' as const,
      source: 'admin' as const,
      inviteExpiresAt: null,
    }));

    return { data: admins, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

/** Find the role id for a given role name. */
export async function getRoleIdByName(roleName: string): Promise<DbResult<string>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: (data as { id: string }).id, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
