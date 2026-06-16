-- Migration 024: Private bucket for temporary hardware PDF uploads
-- Files land here when too large for Vercel's 4.5 MB request-body limit.
-- The API downloads the file, processes it, then deletes it in the same request.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp-pdf-uploads',
  'temp-pdf-uploads',
  false,        -- private: no public URLs, only service-role can read
  52428800,     -- 50 MB per file
  ARRAY['application/pdf', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users may upload their own temp PDFs
CREATE POLICY "Authenticated upload temp PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'temp-pdf-uploads');

-- Authenticated users may delete temp PDFs (client-side cleanup on cancel/error)
CREATE POLICY "Authenticated delete temp PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'temp-pdf-uploads');
