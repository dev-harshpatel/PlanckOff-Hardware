-- 015_proposal_extras.sql
-- Adds extra expense rows, allocation toggle, and tax % to the Proposal tab

-- Extend project_pricing_proposal with two new scalar fields
ALTER TABLE project_pricing_proposal
  ADD COLUMN IF NOT EXISTS allocate_expenses BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_pct           NUMERIC(8,4) NOT NULL DEFAULT 0;

-- Per-project extra expense line items (ordered list)
CREATE TABLE IF NOT EXISTS project_proposal_expenses (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID          NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order  INTEGER       NOT NULL DEFAULT 0,
  delivery    TEXT          NOT NULL DEFAULT '',
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_proposal_expenses_project_idx
  ON project_proposal_expenses (project_id, sort_order);

DROP TRIGGER IF EXISTS project_proposal_expenses_set_updated_at ON project_proposal_expenses;
CREATE TRIGGER project_proposal_expenses_set_updated_at
  BEFORE UPDATE ON project_proposal_expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE project_proposal_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_proposal_expenses_select ON project_proposal_expenses;
CREATE POLICY project_proposal_expenses_select ON project_proposal_expenses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS project_proposal_expenses_all ON project_proposal_expenses;
CREATE POLICY project_proposal_expenses_all ON project_proposal_expenses
  FOR ALL USING (true);
