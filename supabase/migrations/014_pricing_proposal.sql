-- 014_pricing_proposal.sql
-- Stores per-project profit percentages for the Proposal tab

CREATE TABLE IF NOT EXISTS project_pricing_proposal (
  project_id       UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  profit_door      NUMERIC(8, 4) NOT NULL DEFAULT 0,
  profit_frame     NUMERIC(8, 4) NOT NULL DEFAULT 0,
  profit_hardware  NUMERIC(8, 4) NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
