-- 018_proposal_tax_rows.sql
-- Replaces the single tax_pct field with a per-project list of named tax rows

CREATE TABLE IF NOT EXISTS project_proposal_tax_rows (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  description TEXT          NOT NULL DEFAULT '',
  tax_pct     NUMERIC(8,4)  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_proposal_tax_rows_project_idx
  ON project_proposal_tax_rows (project_id, sort_order);

DROP TRIGGER IF EXISTS project_proposal_tax_rows_set_updated_at ON project_proposal_tax_rows;
CREATE TRIGGER project_proposal_tax_rows_set_updated_at
  BEFORE UPDATE ON project_proposal_tax_rows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE project_proposal_tax_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_proposal_tax_rows_select ON project_proposal_tax_rows;
CREATE POLICY project_proposal_tax_rows_select ON project_proposal_tax_rows
  FOR SELECT USING (true);

DROP POLICY IF EXISTS project_proposal_tax_rows_all ON project_proposal_tax_rows;
CREATE POLICY project_proposal_tax_rows_all ON project_proposal_tax_rows
  FOR ALL USING (true);
