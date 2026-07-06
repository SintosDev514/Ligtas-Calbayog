-- 035_create_police_post_assignments.sql
-- Links police officers to police posts for patrol assignments

CREATE TABLE IF NOT EXISTS public.police_post_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.police_posts(id) ON DELETE CASCADE,
  officer_id UUID NOT NULL REFERENCES public.police_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, officer_id)
);

ALTER TABLE public.police_post_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view assignments"
  ON public.police_post_assignments FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage assignments"
  ON public.police_post_assignments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete assignments"
  ON public.police_post_assignments FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_post_assignments_post ON public.police_post_assignments (post_id);
CREATE INDEX IF NOT EXISTS idx_post_assignments_officer ON public.police_post_assignments (officer_id);
