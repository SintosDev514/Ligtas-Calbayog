-- 036_allow_residents_read_police_profiles.sql
-- Residents need to see police officer names when viewing police post assignments on the map

DROP POLICY IF EXISTS "Police and admins can view police profiles" ON public.police_profiles;

CREATE POLICY "Anyone can view police profiles"
  ON public.police_profiles FOR SELECT
  USING (true);
