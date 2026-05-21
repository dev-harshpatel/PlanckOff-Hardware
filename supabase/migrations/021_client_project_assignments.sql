-- =============================================================================
-- Migration 021: Client project assignments
-- Authoritative junction table for which projects a Client user may access.
-- The existing projects.assigned_to column is unscoped and not enforced here;
-- do NOT rely on it for Client access control.
--
-- assigned_by is nullable so that administrator accounts (which live in the
-- admins table rather than team_members) can also create assignments.
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_project_assignments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  project_id  uuid        NOT NULL REFERENCES projects(id)     ON DELETE CASCADE,
  assigned_by uuid        REFERENCES team_members(id)          ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_cpa_client_id  ON client_project_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_cpa_project_id ON client_project_assignments(project_id);
