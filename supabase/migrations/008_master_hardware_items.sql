-- =============================================================================
-- Migration 008: Master hardware items + pending approval queue
--
-- master_hardware_items  — the canonical, approved product database
-- master_hardware_pending — items extracted from PDFs awaiting admin review
--
-- Uniqueness key: (LOWER(TRIM(name)), LOWER(TRIM(manufacturer)),
--                  LOWER(TRIM(description)), LOWER(TRIM(finish)))
-- If all four fields match an existing row → duplicate (skip).
-- If any field differs → treat as a new item and queue for approval.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. master_hardware_items
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master_hardware_items (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  manufacturer       text        NOT NULL DEFAULT '',
  description        text        NOT NULL DEFAULT '',
  finish             text        NOT NULL DEFAULT '',
  model_number       text        NOT NULL DEFAULT '',
  source_project_id  uuid        REFERENCES projects(id) ON DELETE SET NULL,
  source_file_name   text,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_master_hw_items_name
  ON master_hardware_items (LOWER(TRIM(name)));

DROP TRIGGER IF EXISTS master_hw_items_set_updated_at ON master_hardware_items;
CREATE TRIGGER master_hw_items_set_updated_at
  BEFORE UPDATE ON master_hardware_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. master_hardware_pending  (approval queue)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master_hardware_pending (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  manufacturer       text        NOT NULL DEFAULT '',
  description        text        NOT NULL DEFAULT '',
  finish             text        NOT NULL DEFAULT '',
  model_number       text        NOT NULL DEFAULT '',
  source_project_id  uuid        REFERENCES projects(id) ON DELETE SET NULL,
  source_file_name   text,
  status             text        NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by       uuid,
  reviewed_by        uuid,
  submitted_at       timestamptz NOT NULL DEFAULT now(),
  reviewed_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_master_hw_pending_status
  ON master_hardware_pending (status);
