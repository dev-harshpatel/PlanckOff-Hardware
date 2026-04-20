-- Migration 006: Fix door-elevations storage RLS policies
--
-- WHY: Auth is currently a stub — no real Supabase session exists, so the
-- Supabase client runs as the `anon` role. The original policies in 005 were
-- scoped to `authenticated` only, causing RLS violations on upload/delete.
-- Until real auth (Phase 1) is wired up, allow `anon` alongside `authenticated`.

-- Drop the old restrictive policies from migration 005
DROP POLICY IF EXISTS "Authenticated upload door elevations"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update door elevations"  ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete door elevations"  ON storage.objects;

-- Upload: allow both anon and authenticated
CREATE POLICY "Upload door elevations"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'door-elevations');

-- Update/replace: allow both anon and authenticated
CREATE POLICY "Update door elevations"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'door-elevations');

-- Delete (used when replacing an image): allow both anon and authenticated
CREATE POLICY "Delete door elevations"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'door-elevations');
