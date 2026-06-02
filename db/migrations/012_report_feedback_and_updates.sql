-- Migration: Add report_feedback and action_updates tables
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.report_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.crime_reports(id) ON DELETE CASCADE,
  officer_name TEXT,
  response_message TEXT,
  estimated_arrival TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents can view their own report feedback"
  ON public.report_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crime_reports
      WHERE crime_reports.id = report_feedback.report_id
        AND crime_reports.resident_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_report_feedback_report_id
  ON public.report_feedback (report_id);

CREATE TABLE IF NOT EXISTS public.action_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.crime_reports(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.action_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents can view their own action updates"
  ON public.action_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crime_reports
      WHERE crime_reports.id = action_updates.report_id
        AND crime_reports.resident_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_action_updates_report_id
  ON public.action_updates (report_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_feedback;
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_updates;
