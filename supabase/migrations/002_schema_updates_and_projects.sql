-- =============================================================================
-- Migration 002: Schema updates + Projects table
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. admins — add updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Auto-update trigger for admins.updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admins_set_updated_at ON admins;
CREATE TRIGGER admins_set_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. team_members — add reports_to + updated_at
-- -----------------------------------------------------------------------------
ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS reports_to  uuid REFERENCES team_members (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS team_members_set_updated_at ON team_members;
CREATE TRIGGER team_members_set_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. roles — add level + description
-- -----------------------------------------------------------------------------
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS level       integer,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE roles SET level = 1, description = 'Full system access and team management'  WHERE name = 'Administrator';
UPDATE roles SET level = 2, description = 'Manage estimators and oversee projects'  WHERE name = 'Team Lead';
UPDATE roles SET level = 3, description = 'Create and manage estimates'              WHERE name = 'Estimator';

-- -----------------------------------------------------------------------------
-- 4. projects table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  client           text,
  location         text,
  description      text,
  project_number   text,
  status           text NOT NULL DEFAULT 'Active',
  due_date         date,
  -- assigned_to can be an admin id or a team_member id — no FK since two tables
  assigned_to      uuid,
  -- Full project data stored as JSONB (Phase 1 migration approach)
  -- Will be normalised into relational tables in Phase 2
  doors            jsonb NOT NULL DEFAULT '[]',
  hardware_sets    jsonb NOT NULL DEFAULT '[]',
  elevation_types  jsonb NOT NULL DEFAULT '[]',
  -- Soft delete
  deleted_at       timestamptz,
  -- Audit
  created_by       uuid,  -- admin or team_member id
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects (deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects (created_by);

DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
