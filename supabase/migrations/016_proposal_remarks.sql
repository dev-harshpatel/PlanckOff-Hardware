-- 016_proposal_remarks.sql
-- Adds a free-text remarks field to the Proposal tab

ALTER TABLE project_pricing_proposal
  ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';
