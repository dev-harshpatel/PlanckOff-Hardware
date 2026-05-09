-- =============================================================================
-- Migration 019: Enable Supabase Realtime for pricing + projects tables
-- =============================================================================
-- Adds the three tables that Phase 4 subscribes to so the UI receives
-- postgres_changes events. Without these ALTER PUBLICATION statements,
-- subscriptions to these tables silently produce no events — the channel
-- reports SUBSCRIBED but callbacks never fire.
--
-- Tables already in publication via migration 012:
--   - door_schedule_imports
--   - project_hardware_finals
--
-- Tables added by this migration:
--   - project_pricing_items     (created in migration 013)
--   - project_pricing_proposal  (created in migration 014)
--   - projects                  (created in migration 002)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_pricing_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_pricing_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'project_pricing_proposal'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_pricing_proposal;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'projects'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE projects;
  END IF;
END $$;
