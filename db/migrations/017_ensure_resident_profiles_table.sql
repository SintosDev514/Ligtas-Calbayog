-- Migration: Ensure resident_profiles table exists with proper schema and RLS
-- Fixes the naming mismatch: migration 001 created 'resident_profile' (singular)
-- but the app code queries 'resident_profiles' (plural)r

-- 1. Create resident_profiles if it doesn't exist (with id PK matching auth.users)
CREATE TABLE IF NOT EXISTS public.resident_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  address TEXT,
  emergency_contact TEXT,
  avatar_url TEXT,
  photo_url TEXT,
  id_photo_url TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  guardian_name TEXT,
  guardian_phone TEXT,
  father_name TEXT,
  father_phone TEXT,
  mother_phone TEXT,
  cancel_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Migrate data from old resident_profile (singular) if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'resident_profile'
  ) THEN
    INSERT INTO public.resident_profiles (
      id, full_name, phone_number, address, emergency_contact,
      photo_url, created_at, updated_at
    )
    SELECT
      user_id, full_name, phone_number, address, emergency_contact,
      profile_photo_url, created_at, updated_at
    FROM public.resident_profile
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 3. Add any missing columns (safety for tables created outside migrations)
ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS id_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS guardian_name TEXT,
  ADD COLUMN IF NOT EXISTS guardian_phone TEXT,
  ADD COLUMN IF NOT EXISTS father_name TEXT,
  ADD COLUMN IF NOT EXISTS father_phone TEXT,
  ADD COLUMN IF NOT EXISTS mother_phone TEXT,
  ADD COLUMN IF NOT EXISTS cancel_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Sync avatar_url to photo_url so police dashboard (which reads photo_url) works
UPDATE public.resident_profiles
SET photo_url = avatar_url
WHERE photo_url IS NULL AND avatar_url IS NOT NULL;

UPDATE public.resident_profiles
SET avatar_url = photo_url
WHERE avatar_url IS NULL AND photo_url IS NOT NULL;

-- 4. Enable RLS and set up policies
ALTER TABLE public.resident_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.resident_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.resident_profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.resident_profiles;
DROP POLICY IF EXISTS "Police can view resident_profiles" ON public.resident_profiles;

-- Residents can manage their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.resident_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.resident_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own profile"
  ON public.resident_profiles FOR SELECT
  USING (auth.uid() = id);

-- Police can view all resident profiles
-- Uses auth.uid() IS NOT NULL to allow any authenticated user (police) to view
CREATE POLICY "Police can view resident_profiles"
  ON public.resident_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 5. Drop the old singular-named table if it still exists
DROP TABLE IF EXISTS public.resident_profile;

-- 6. Ensure crime_reports has proper RLS for police
ALTER TABLE public.crime_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Police can view all crime_reports" ON public.crime_reports;
DROP POLICY IF EXISTS "Police can update crime_reports" ON public.crime_reports;

CREATE POLICY "Police can view all crime_reports"
  ON public.crime_reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Police can update crime_reports"
  ON public.crime_reports FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.resident_profiles TO authenticated;
GRANT SELECT, UPDATE ON public.crime_reports TO authenticated;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_resident_profiles_id ON public.resident_profiles (id);
CREATE INDEX IF NOT EXISTS idx_resident_profiles_lat_lng ON public.resident_profiles (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_crime_reports_resident_id ON public.crime_reports (resident_id);
