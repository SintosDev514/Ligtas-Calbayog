-- Migration: Allow report_id to be NULL in police_locations
-- This enables officers to send "heartbeat" locations even without an active report,
-- so they appear on the admin live tracking map whenever they're logged in.

-- 1. Make report_id nullable
ALTER TABLE public.police_locations ALTER COLUMN report_id DROP NOT NULL;

-- 2. Drop the old unique index that required both columns
DROP INDEX IF EXISTS idx_police_locations_officer_report;

-- 3. Create a partial unique index for rows WITH a report (one location per officer per report)
CREATE UNIQUE INDEX idx_police_locations_officer_report
  ON public.police_locations (officer_id, report_id)
  WHERE report_id IS NOT NULL;

-- 4. Create a unique index for the "online" heartbeat (one location per officer when off-duty)
CREATE UNIQUE INDEX idx_police_locations_officer_online
  ON public.police_locations (officer_id)
  WHERE report_id IS NULL;

-- 5. Update RLS to allow officers to insert/update their own location
DROP POLICY IF EXISTS "Officers can insert own location" ON public.police_locations;
DROP POLICY IF EXISTS "Officers can update own location" ON public.police_locations;
DROP POLICY IF EXISTS "Residents can view police on their report" ON public.police_locations;

CREATE POLICY "Officers can insert own location"
  ON public.police_locations FOR INSERT
  WITH CHECK (auth.uid() = officer_id);

CREATE POLICY "Officers can update own location"
  ON public.police_locations FOR UPDATE
  USING (auth.uid() = officer_id)
  WITH CHECK (auth.uid() = officer_id);

CREATE POLICY "Admins can view all locations"
  ON public.police_locations FOR SELECT
  USING (
    auth.uid() = officer_id
    OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM public.police_profiles WHERE id = auth.uid())
  );
