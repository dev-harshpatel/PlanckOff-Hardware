-- =============================================================================
-- Migration 010: Enforce uniqueness on master hardware tables
--
-- Problem: master_hardware_items and master_hardware_pending had no DB-level
-- unique constraint, allowing duplicates to accumulate from multiple upload runs.
--
-- Fix:
--   1. Deduplicate existing rows in master_hardware_items (keep earliest created_at)
--   2. Add UNIQUE expression index on the 4-field key for master_hardware_items
--   3. Deduplicate existing pending rows in master_hardware_pending
--   4. Add partial UNIQUE expression index for status='pending' rows
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Deduplicate master_hardware_items
--    Keep the row with the earliest created_at for each unique 4-field key.
-- -----------------------------------------------------------------------------
DELETE FROM master_hardware_items
WHERE id NOT IN (
  SELECT DISTINCT ON (
    LOWER(TRIM(name)),
    LOWER(TRIM(manufacturer)),
    LOWER(TRIM(description)),
    LOWER(TRIM(finish))
  ) id
  FROM master_hardware_items
  ORDER BY
    LOWER(TRIM(name)),
    LOWER(TRIM(manufacturer)),
    LOWER(TRIM(description)),
    LOWER(TRIM(finish)),
    created_at ASC
);

-- -----------------------------------------------------------------------------
-- 2. Add UNIQUE expression index on master_hardware_items
--    Uniqueness key: (lower+trim of name, manufacturer, description, finish)
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS uq_master_hw_items_4fields;
CREATE UNIQUE INDEX uq_master_hw_items_4fields
ON master_hardware_items (
  LOWER(TRIM(name)),
  LOWER(TRIM(manufacturer)),
  LOWER(TRIM(description)),
  LOWER(TRIM(finish))
);

-- -----------------------------------------------------------------------------
-- 3. Deduplicate master_hardware_pending (status='pending' only)
--    Keep the row with the earliest submitted_at.
--    Approved/rejected rows are left as-is (they're history).
-- -----------------------------------------------------------------------------
DELETE FROM master_hardware_pending
WHERE status = 'pending'
  AND id NOT IN (
    SELECT DISTINCT ON (
      LOWER(TRIM(name)),
      LOWER(TRIM(manufacturer)),
      LOWER(TRIM(description)),
      LOWER(TRIM(finish))
    ) id
    FROM master_hardware_pending
    WHERE status = 'pending'
    ORDER BY
      LOWER(TRIM(name)),
      LOWER(TRIM(manufacturer)),
      LOWER(TRIM(description)),
      LOWER(TRIM(finish)),
      submitted_at ASC
  );

-- -----------------------------------------------------------------------------
-- 4. Partial UNIQUE index on master_hardware_pending for pending rows
--    Only enforces uniqueness while an item is awaiting review.
--    Once approved/rejected, the slot is freed for re-submission.
-- -----------------------------------------------------------------------------
DROP INDEX IF EXISTS uq_master_hw_pending_4fields_pending;
CREATE UNIQUE INDEX uq_master_hw_pending_4fields_pending
ON master_hardware_pending (
  LOWER(TRIM(name)),
  LOWER(TRIM(manufacturer)),
  LOWER(TRIM(description)),
  LOWER(TRIM(finish))
) WHERE status = 'pending';
