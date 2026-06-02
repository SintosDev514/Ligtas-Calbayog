-- Migration: Cancel report penalties and appeal system
-- Run this in your Supabase SQL editor

-- Add cancel_count to resident_profiles
ALTER TABLE resident_profiles
ADD COLUMN IF NOT EXISTS cancel_count INTEGER DEFAULT 0;

-- Penalties table for tracking warnings, restrictions, and bans
CREATE TABLE IF NOT EXISTS public.penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('warning', 'restriction', 'ban')),
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  appeal_status TEXT DEFAULT 'none' CHECK (appeal_status IN ('none', 'pending', 'approved', 'rejected')),
  appeal_message TEXT,
  appealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

-- Residents can view their own penalties
CREATE POLICY "Users can view their own penalties"
  ON public.penalties FOR SELECT
  USING (auth.uid() = user_id);

-- Residents can update appeal for their own penalties
CREATE POLICY "Users can appeal their own penalties"
  ON public.penalties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND appeal_status = 'none');

CREATE INDEX IF NOT EXISTS idx_penalties_user_id ON public.penalties (user_id);
CREATE INDEX IF NOT EXISTS idx_penalties_active ON public.penalties (user_id, is_active);
