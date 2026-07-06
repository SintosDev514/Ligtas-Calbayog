-- Migration: Allow police officers and admins to insert action_updates
-- The table only has a SELECT policy for residents; INSERT is denied by RLS default.

-- Ensure officer_id column exists (may have been added manually)
ALTER TABLE public.action_updates
ADD COLUMN IF NOT EXISTS officer_id UUID REFERENCES public.police_profiles(id) ON DELETE SET NULL;

-- Allow police and admins to insert action_updates
CREATE POLICY "Police and admins can insert action updates"
  ON public.action_updates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.police_profiles WHERE id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Broaden SELECT policy to include police and admins
DROP POLICY IF EXISTS "Residents can view their own action updates" ON public.action_updates;

CREATE POLICY "View action updates"
  ON public.action_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.crime_reports
      WHERE crime_reports.id = action_updates.report_id
        AND crime_reports.resident_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM public.police_profiles WHERE id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
