-- =============================================================================
-- Migration 020: Add Client role
-- Adds the 'Client' role to the roles table for v4.0 client-portal use.
-- Permissions: read-only project access — no team management, no invitations,
-- no project deletion.
-- Idempotent — safe to re-apply via ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO roles (name, permissions) VALUES
  ('Client', '{"canManageTeam": false, "canInviteUsers": false, "canDeleteProjects": false, "canViewAllProjects": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;
