-- Migration: Create police_profiles table
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.police_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  badge_id TEXT NOT NULL UNIQUE,
  rank TEXT NOT NULL,
  station TEXT NOT NULL,
  phone_number TEXT,
  police_id_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.police_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Police can view own profile"
  ON public.police_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Police can insert own profile"
  ON public.police_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Police can update own profile"
  ON public.police_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow police to view resident locations (for tracking)
CREATE POLICY "Police can view resident_profiles"
  ON public.resident_profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.police_profiles WHERE id = auth.uid()));

-- Allow police to view and update crime_reports
CREATE POLICY "Police can view all crime_reports"
  ON public.crime_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.police_profiles WHERE id = auth.uid()));

CREATE POLICY "Police can update crime_reports"
  ON public.crime_reports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.police_profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_police_profiles_badge_id ON public.police_profiles (badge_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.police_profiles TO authenticated;
