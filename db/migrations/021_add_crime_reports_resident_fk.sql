-- Migration: Add foreign key from crime_reports.resident_id to resident_profiles.id
-- This enables PostgREST joins in Supabase API queries

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'crime_reports_resident_id_fkey'
      AND table_name = 'crime_reports'
  ) THEN
    ALTER TABLE public.crime_reports
      ADD CONSTRAINT crime_reports_resident_id_fkey
      FOREIGN KEY (resident_id) REFERENCES public.resident_profiles(id)
      ON DELETE CASCADE;
  END IF;
END $$;
