-- Migration 044: Add heading to police_locations
-- Stores the officer's compass heading (degrees 0-360) so the admin web
-- Route Overview can rotate the officer direction arrow the same way the
-- police app does from its device compass.

ALTER TABLE public.police_locations
  ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION;
