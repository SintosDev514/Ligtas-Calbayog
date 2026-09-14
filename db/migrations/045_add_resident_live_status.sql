-- Migration: Add live-status flag to resident_profiles
-- Lets contacts see a green "active" indicator when a resident turns on their live location.
ALTER TABLE public.resident_profiles
  ADD COLUMN IF NOT EXISTS share_live_location BOOLEAN DEFAULT FALSE;