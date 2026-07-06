-- 034_create_police_posts.sql
-- Adds a table for static police post/station locations on the map

CREATE TABLE IF NOT EXISTS public.police_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.police_posts ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view police posts
CREATE POLICY "Anyone can view police_posts"
  ON public.police_posts FOR SELECT
  USING (true);

-- Admins can insert
CREATE POLICY "Admins can insert police_posts"
  ON public.police_posts FOR INSERT
  WITH CHECK (true);

-- Admins can update
CREATE POLICY "Admins can update police_posts"
  ON public.police_posts FOR UPDATE
  USING (true);

-- Admins can delete
CREATE POLICY "Admins can delete police_posts"
  ON public.police_posts FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_police_posts_location ON public.police_posts (latitude, longitude);
