-- =============================================================================
-- Migration 004: Hardware data tables (JSON blob storage)
--
-- Flow:
--   1. Upload Hardware PDF  → OpenRouter extracts JSON → stored in hardware_pdf_extractions
--   2. Import Excel sheet   → parsed to JSON          → stored in door_schedule_imports
--   3. Merge step           → match on set_name       → stored in project_hardware_finals
--
-- Each table stores the full JSON as-is. No field-level normalisation.
-- The set_name is the join key used during the merge step (not a DB FK).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop JSONB blobs from projects — replaced by the three tables below
-- -----------------------------------------------------------------------------
ALTER TABLE projects
  DROP COLUMN IF EXISTS doors,
  DROP COLUMN IF EXISTS hardware_sets,
  DROP COLUMN IF EXISTS elevation_types;

-- -----------------------------------------------------------------------------
-- 2. hardware_pdf_extractions
--    Stores the raw JSON extracted from the uploaded Hardware PDF via OpenRouter.
--    Shape: [ { setName, hardwareItems: [{ qty, item, manufacturer, description, finish }] } ]
--    One upload per project (can be re-uploaded, previous row replaced).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hardware_pdf_extractions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Full extracted JSON from the PDF — array of hardware sets with their items
  extracted_json  jsonb    NOT NULL DEFAULT '[]',
  -- Metadata about the source file
  file_name    text,
  uploaded_by  uuid,       -- admin or team_member id
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- One active extraction per project (re-upload overwrites)
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_hw_pdf_extractions_project_id ON hardware_pdf_extractions (project_id);

DROP TRIGGER IF EXISTS hw_pdf_extractions_set_updated_at ON hardware_pdf_extractions;
CREATE TRIGGER hw_pdf_extractions_set_updated_at
  BEFORE UPDATE ON hardware_pdf_extractions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. door_schedule_imports
--    Stores the full JSON parsed from the imported Excel door schedule.
--    Shape: [ { doorTag, hwSet, doorLocation, fireRating, ... (all columns) } ]
--    One import per project (can be re-imported, previous row replaced).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS door_schedule_imports (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Full parsed JSON from the Excel sheet — array of door rows
  schedule_json   jsonb    NOT NULL DEFAULT '[]',
  -- Metadata about the source file
  file_name    text,
  uploaded_by  uuid,       -- admin or team_member id
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- One active import per project (re-import overwrites)
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_door_schedule_imports_project_id ON door_schedule_imports (project_id);

DROP TRIGGER IF EXISTS door_schedule_imports_set_updated_at ON door_schedule_imports;
CREATE TRIGGER door_schedule_imports_set_updated_at
  BEFORE UPDATE ON door_schedule_imports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. project_hardware_finals
--    Stores the final merged JSON produced by matching PDF sets with Excel doors.
--    Shape: [ { setName, doors: [...], hardwareItems: [...], notes: {...} } ]
--    This is the canonical working data for a project.
--    Regenerated whenever PDF or Excel is re-uploaded.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_hardware_finals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Full merged JSON — array of hardware sets with matched doors and items
  final_json      jsonb    NOT NULL DEFAULT '[]',
  -- Tracks which source versions produced this final (for cache invalidation)
  pdf_extraction_id   uuid REFERENCES hardware_pdf_extractions(id) ON DELETE SET NULL,
  door_schedule_id    uuid REFERENCES door_schedule_imports(id)    ON DELETE SET NULL,
  generated_by uuid,       -- admin or team_member id
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- One final JSON per project
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_hardware_finals_project_id ON project_hardware_finals (project_id);

DROP TRIGGER IF EXISTS project_hardware_finals_set_updated_at ON project_hardware_finals;
CREATE TRIGGER project_hardware_finals_set_updated_at
  BEFORE UPDATE ON project_hardware_finals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
