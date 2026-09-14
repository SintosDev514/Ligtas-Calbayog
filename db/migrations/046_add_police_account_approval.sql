-- Migration 046: Police account approval
-- Officers must be approved by an admin before they can sign in to the Police app.

-- 1. Add approval flag (existing registrations become pending until approved)
ALTER TABLE public.police_profiles
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Existing officers are considered pre-approved
UPDATE public.police_profiles SET is_approved = TRUE WHERE is_approved = FALSE;

-- 3. Admins can update police profiles (approve registrations)
-- Uses public.is_admin() from migration 040 to avoid RLS recursion.
DROP POLICY IF EXISTS "Admins can update police profiles" ON public.police_profiles;
CREATE POLICY "Admins can update police profiles"
  ON public.police_profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());