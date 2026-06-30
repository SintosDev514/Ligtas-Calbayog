-- Migration: Add RLS policies for announcements table
-- Allows public SELECT, admin-only INSERT/UPDATE/DELETE

-- Anyone can view announcements
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
CREATE POLICY "Anyone can view announcements"
  ON public.announcements FOR SELECT
  USING (true);

-- Admin can insert announcements (check role in users table)
DROP POLICY IF EXISTS "Admin can insert announcements" ON public.announcements;
CREATE POLICY "Admin can insert announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Admin can update announcements
DROP POLICY IF EXISTS "Admin can update announcements" ON public.announcements;
CREATE POLICY "Admin can update announcements"
  ON public.announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Admin can delete announcements
DROP POLICY IF EXISTS "Admin can delete announcements" ON public.announcements;
CREATE POLICY "Admin can delete announcements"
  ON public.announcements FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
