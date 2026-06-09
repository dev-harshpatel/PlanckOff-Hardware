-- =============================================================================
-- Migration 022: Project processing locks
--
-- Prevents duplicate concurrent processing jobs for the same project.
-- A row is inserted when a job starts and deleted (in a finally block) when it
-- ends — whether the job succeeds, errors, or is cancelled by the user.
--
-- Stale locks (jobs that crashed or were killed by Vercel's 300s timeout) are
-- detected via started_at and overwritten after STALE_LOCK_SECONDS (360s).
-- =============================================================================

CREATE TABLE IF NOT EXISTS project_processing_locks (
  project_id  uuid        PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  started_at  timestamptz NOT NULL DEFAULT now(),
  lock_id     text        NOT NULL
);

-- Only the service-role (admin) client touches this table.
ALTER TABLE project_processing_locks ENABLE ROW LEVEL SECURITY;
