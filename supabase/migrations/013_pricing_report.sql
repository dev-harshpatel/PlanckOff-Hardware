-- 013_pricing_report.sql
-- Stores user-entered unit prices per project pricing group

CREATE TABLE IF NOT EXISTS project_pricing_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- 'door' | 'frame' | 'hardware'
  category    TEXT NOT NULL CHECK (category IN ('door', 'frame', 'hardware')),
  -- Stable JSON key built from the non-empty grouping fields
  group_key   TEXT NOT NULL,
  unit_price  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, category, group_key)
);

CREATE INDEX IF NOT EXISTS project_pricing_items_project_idx
  ON project_pricing_items (project_id, category);
