-- Migration 005: Supabase Storage bucket for door elevation images
-- Run this in the Supabase SQL editor or via supabase db push

-- Create the storage bucket (public read — elevation drawings are non-sensitive)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'door-elevations',
  'door-elevations',
  true,
  5242880,  -- 5 MB cap per file (compressed WebP will be well under this)
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Public read: anyone with the URL can view the image
CREATE POLICY "Public read door elevations"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'door-elevations');

-- Upload: allow anon + authenticated (auth is a stub until Phase 1)
CREATE POLICY "Upload door elevations"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'door-elevations');

-- Update/replace
CREATE POLICY "Update door elevations"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id = 'door-elevations');

-- Delete (used when replacing an existing image)
CREATE POLICY "Delete door elevations"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id = 'door-elevations');
