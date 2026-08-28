-- Migration 042: Add validation & triage fields to crime_reports
-- Supports the Report Validation & Triage feature in the admin web.

-- Urgency triage level assigned by the admin during validation.
ALTER TABLE public.crime_reports
  ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'medium';

-- Whether the report has been reviewed / validated by an admin.
ALTER TABLE public.crime_reports
  ADD COLUMN IF NOT EXISTS is_validated BOOLEAN NOT NULL DEFAULT FALSE;

-- Free-form notes captured during validation (or the reason for dismissal).
ALTER TABLE public.crime_reports
  ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Admin (public.users) who performed the validation.
ALTER TABLE public.crime_reports
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- When the report was validated.
ALTER TABLE public.crime_reports
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- Indexes for triage filtering / sorting.
CREATE INDEX IF NOT EXISTS idx_crime_reports_urgency
  ON public.crime_reports (urgency);

CREATE INDEX IF NOT EXISTS idx_crime_reports_is_validated
  ON public.crime_reports (is_validated);