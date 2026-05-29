-- Migration: Add share_live_location to crime_reports
-- Run this in the Supabase SQL editor or using psql/supabase CLI

ALTER TABLE public.crime_reports
ADD COLUMN IF NOT EXISTS share_live_location BOOLEAN DEFAULT FALSE;

-- Optional: set existing rows to FALSE explicitly
UPDATE public.crime_reports
SET share_live_location = FALSE
WHERE share_live_location IS NULL;

-- Index (optional) for faster lookups by live-sharing flag
CREATE INDEX IF NOT EXISTS idx_crime_reports_share_live_location
ON public.crime_reports (share_live_location);
