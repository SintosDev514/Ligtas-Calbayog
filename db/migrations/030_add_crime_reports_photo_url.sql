-- Add photo_url column to crime_reports table if not exists

ALTER TABLE public.crime_reports
ADD COLUMN IF NOT EXISTS photo_url TEXT;
