-- =============================================================================
-- Migration 012: Enable Supabase Realtime for live-update tables
-- =============================================================================
-- Adds the tables that the client subscribes to so the UI can reflect
-- changes made by any session without a full page reload.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'door_schedule_imports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE door_schedule_imports;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_hardware_finals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_hardware_finals;
  END IF;
END $$;
