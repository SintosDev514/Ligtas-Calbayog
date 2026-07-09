-- Migration: Create police_location_history for route tracking
-- Automatically logs every location update from police_locations

CREATE TABLE IF NOT EXISTS public.police_location_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  officer_id UUID NOT NULL REFERENCES public.police_profiles(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.crime_reports(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_police_loc_history_officer_time
  ON public.police_location_history (officer_id, created_at DESC);

ALTER TABLE public.police_location_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all location history"
  ON public.police_location_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Officers can insert their own location history"
  ON public.police_location_history FOR INSERT
  WITH CHECK (auth.uid() = officer_id);

ALTER TABLE public.police_location_history REPLICA IDENTITY FULL;

-- Trigger function to log police_locations changes
CREATE OR REPLACE FUNCTION public.log_police_location()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.police_location_history (officer_id, report_id, latitude, longitude, created_at)
  VALUES (NEW.officer_id, NEW.report_id, NEW.latitude, NEW.longitude, NEW.updated_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_police_location_log ON public.police_locations;
CREATE TRIGGER trg_police_location_log
  AFTER INSERT OR UPDATE ON public.police_locations
  FOR EACH ROW EXECUTE FUNCTION public.log_police_location();
