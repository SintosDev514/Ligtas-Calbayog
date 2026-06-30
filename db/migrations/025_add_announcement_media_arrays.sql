-- Migration: Add JSONB array columns for multiple images and videos
-- Keeps old single-value columns for backward compatibility

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_urls JSONB DEFAULT '[]'::jsonb;
