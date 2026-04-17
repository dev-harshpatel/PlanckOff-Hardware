-- =============================================================================
-- Migration 003: Project location lookup + project country/province fields
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_location_provinces (
  id             bigserial PRIMARY KEY,
  country_code   text NOT NULL,
  country_name   text NOT NULL,
  province_code  text NOT NULL,
  province_name  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_location_provinces_country_province_key UNIQUE (country_code, province_code)
);

CREATE INDEX IF NOT EXISTS idx_project_location_provinces_country_code
  ON project_location_provinces (country_code);

CREATE INDEX IF NOT EXISTS idx_project_location_provinces_country_name
  ON project_location_provinces (country_name);

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS province text;

DROP TRIGGER IF EXISTS project_location_provinces_set_updated_at ON project_location_provinces;
CREATE TRIGGER project_location_provinces_set_updated_at
  BEFORE UPDATE ON project_location_provinces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
