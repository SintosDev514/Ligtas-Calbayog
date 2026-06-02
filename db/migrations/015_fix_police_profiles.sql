-- Migration: Fix police_profiles schema (add missing columns)
-- Run this if table already exists but columns are missing

ALTER TABLE public.police_profiles 
  ADD COLUMN IF NOT EXISTS badge_id TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rank TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS station TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS police_id_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Make badge_id unique after adding it
ALTER TABLE public.police_profiles 
  ADD CONSTRAINT police_profiles_badge_id_key UNIQUE (badge_id);

CREATE INDEX IF NOT EXISTS idx_police_profiles_badge_id ON public.police_profiles (badge_id);
