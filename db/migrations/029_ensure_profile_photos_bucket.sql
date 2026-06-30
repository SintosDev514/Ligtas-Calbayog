-- Migration: Ensure profile-photos bucket exists, is public, and has proper policies

-- 1. Create/ensure the bucket is public
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('profile-photos', 'profile-photos', true, false)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to re-create cleanly
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;

-- 3. Allow authenticated users to upload
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');

-- 4. Allow authenticated users to update
CREATE POLICY "Users can update their own profile photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'profile-photos' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');

-- 5. Allow public read access (so images display in the app)
CREATE POLICY "Public can view profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

-- 6. Allow authenticated users to delete
CREATE POLICY "Users can delete their own profile photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'profile-photos' AND auth.role() = 'authenticated');
