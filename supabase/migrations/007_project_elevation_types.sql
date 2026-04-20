-- Migration 007: Persist elevation types on the projects table
--
-- Migration 004 dropped the elevation_types column when it moved doors/hardware
-- to separate tables. But elevation types have no dedicated table and were never
-- reloaded after a page refresh — data was lost on every reload.
-- This adds a simple JSONB column to store the full ElevationType array per project.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS elevation_types jsonb NOT NULL DEFAULT '[]';
