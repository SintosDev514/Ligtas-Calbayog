-- Migration: Add dedicated photo_url column to police_profiles

ALTER TABLE police_profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT;
