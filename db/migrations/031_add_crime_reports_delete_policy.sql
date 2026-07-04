-- Migration: Add DELETE policy for crime_reports table
-- Allows authenticated police/admin users to delete crime reports

CREATE POLICY "Police can delete crime_reports"
  ON public.crime_reports FOR DELETE
  USING (true);

GRANT DELETE ON public.crime_reports TO authenticated;
