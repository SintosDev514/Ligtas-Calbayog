-- Migration: Add assigned_officer_id to crime_reports so police can mark who accepted

ALTER TABLE public.crime_reports
ADD COLUMN IF NOT EXISTS assigned_officer_id UUID REFERENCES public.police_profiles(id) ON DELETE SET NULL;
