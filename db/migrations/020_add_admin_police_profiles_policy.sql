-- Migration: Allow admins to view all police profiles
-- The police_profiles table currently only allows police to view their own profile
-- (auth.uid() = id). Admins need to see all profiles for user management.

-- Drop the existing restrictive policy and create a broader one
DROP POLICY IF EXISTS "Police can view own profile" ON public.police_profiles;

-- Allow police to view their own profile OR admins to view all
CREATE POLICY "Police and admins can view police profiles"
  ON public.police_profiles FOR SELECT
  USING (
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Keep insert/update policies restricted to the officer themselves
DROP POLICY IF EXISTS "Police can insert own profile" ON public.police_profiles;
DROP POLICY IF EXISTS "Police can update own profile" ON public.police_profiles;

CREATE POLICY "Police can insert own profile"
  ON public.police_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Police can update own profile"
  ON public.police_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
