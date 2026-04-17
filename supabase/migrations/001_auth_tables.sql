-- =============================================================================
-- Migration 001: Auth Tables
-- Custom session-based RBAC system
-- =============================================================================

-- Roles table — seed values at bottom
CREATE TABLE IF NOT EXISTS roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text UNIQUE NOT NULL,
  permissions jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Admins table — legacy superusers
CREATE TABLE IF NOT EXISTS admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'Administrator',
  initials      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text UNIQUE NOT NULL,
  password_hash      text,
  name               text NOT NULL,
  role_id            uuid REFERENCES roles (id),
  status             text NOT NULL DEFAULT 'Invited',
  initials           text,
  invited_by         uuid REFERENCES team_members (id),
  invite_token       text UNIQUE,
  invite_expires_at  timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Auth sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token            text UNIQUE NOT NULL,
  admin_id         uuid REFERENCES admins (id) ON DELETE CASCADE,
  team_member_id   uuid REFERENCES team_members (id) ON DELETE CASCADE,
  expires_at       timestamptz NOT NULL,
  ip_address       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Either admin_id or team_member_id must be set, not both
  CONSTRAINT session_owner_check CHECK (
    (admin_id IS NOT NULL AND team_member_id IS NULL) OR
    (admin_id IS NULL AND team_member_id IS NOT NULL)
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token        ON auth_sessions (token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at   ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_team_members_email         ON team_members (email);
CREATE INDEX IF NOT EXISTS idx_team_members_invite_token  ON team_members (invite_token);

-- =============================================================================
-- Seed: Roles
-- =============================================================================
INSERT INTO roles (name, permissions) VALUES
  ('Administrator', '{"canManageTeam": true, "canInviteUsers": true, "canDeleteProjects": true, "canViewAllProjects": true}'::jsonb),
  ('Team Lead',     '{"canManageTeam": true, "canInviteUsers": true, "canDeleteProjects": false, "canViewAllProjects": true}'::jsonb),
  ('Estimator',     '{"canManageTeam": false, "canInviteUsers": false, "canDeleteProjects": false, "canViewAllProjects": false}'::jsonb)
ON CONFLICT (name) DO NOTHING;
