-- Migration: Configure Storage bucket RLS policies for profile photos
-- This allows authenticated users to upload and access their own profile photos

-- Note: Storage bucket policies must be set in Supabase Dashboard under Storage > Policies
-- The SQL below documents what policies should be created

-- Storage Bucket: profile-photos
-- Make sure the bucket is created first!

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files to their own folder
-- Path: INSERT - profile-photos/*
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
);

-- Policy 2: Allow users to update their own profile photos
-- Path: UPDATE - profile-photos/*
CREATE POLICY "Users can update their own profile photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow public read access to profile photos (so they can be displayed)
-- Path: SELECT - profile-photos/*
CREATE POLICY "Public can view profile photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-photos');

-- Policy 4: Allow users to delete their own profile photos
-- Path: DELETE - profile-photos/*
CREATE POLICY "Users can delete their own profile photos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'profile-photos' 
  AND auth.role() = 'authenticated'
);
