-- Migration: Add storage policies for report-photos bucket
-- Allows authenticated users (admin) to upload announcement images

-- Allow authenticated users to upload files to report-photos
DROP POLICY IF EXISTS "Users can upload report photos" ON storage.objects;
CREATE POLICY "Users can upload report photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'report-photos'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their uploads
DROP POLICY IF EXISTS "Users can update report photos" ON storage.objects;
CREATE POLICY "Users can update report photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'report-photos'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'report-photos'
  AND auth.role() = 'authenticated'
);

-- Allow public read access to report photos
DROP POLICY IF EXISTS "Public can view report photos" ON storage.objects;
CREATE POLICY "Public can view report photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'report-photos');

-- Allow authenticated users to delete their uploads
DROP POLICY IF EXISTS "Users can delete report photos" ON storage.objects;
CREATE POLICY "Users can delete report photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'report-photos'
  AND auth.role() = 'authenticated'
);
