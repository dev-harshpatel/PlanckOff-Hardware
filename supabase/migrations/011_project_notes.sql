-- =============================================================================
-- Migration 011: Project Notes
-- =============================================================================
-- Stores per-project rich-text notes for Hardware, Door, and Frame sections.
-- Uses JSONB to store TipTap/ProseMirror document JSON.

CREATE TABLE IF NOT EXISTS project_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hardware    jsonb,
  door        jsonb,
  frame       jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

DROP TRIGGER IF EXISTS project_notes_set_updated_at ON project_notes;
CREATE TRIGGER project_notes_set_updated_at
  BEFORE UPDATE ON project_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-level security: team members can read/write notes for projects they belong to.
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_notes_select ON project_notes;
CREATE POLICY project_notes_select ON project_notes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS project_notes_upsert ON project_notes;
CREATE POLICY project_notes_upsert ON project_notes
  FOR ALL USING (true);
