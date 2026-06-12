-- Migration: Add police_locations table for real-time officer tracking
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.police_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.police_profiles(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES public.crime_reports(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.police_locations ENABLE ROW LEVEL SECURITY;

-- Police officers can insert/update their own location
CREATE POLICY "Officers can manage their own location"
  ON public.police_locations FOR INSERT
  WITH CHECK (officer_id = auth.uid());

CREATE POLICY "Officers can update their own location"
  ON public.police_locations FOR UPDATE
  USING (officer_id = auth.uid());

-- Residents can view police location for their own reports
CREATE POLICY "Residents can view police location for their reports"
  ON public.police_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crime_reports
      WHERE crime_reports.id = police_locations.report_id
        AND crime_reports.resident_id = auth.uid()
    )
  );

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_police_locations_report_id
  ON public.police_locations (report_id);

CREATE INDEX IF NOT EXISTS idx_police_locations_officer_id
  ON public.police_locations (officer_id);

-- Unique constraint: one location row per officer per report
CREATE UNIQUE INDEX IF NOT EXISTS idx_police_locations_officer_report
  ON public.police_locations (officer_id, report_id);

-- Enable realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.police_locations;
