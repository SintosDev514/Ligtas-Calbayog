-- Migration: Create required storage buckets
-- Run this in Supabase SQL editor to create all needed buckets

-- Create profile-photos bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('profile-photos', 'profile-photos', true, false)
ON CONFLICT (id) DO NOTHING;

-- Create report-photos bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('report-photos', 'report-photos', true, false)
ON CONFLICT (id) DO NOTHING;

-- Create police-ids bucket
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('police-ids', 'police-ids', true, false)
ON CONFLICT (id) DO NOTHING;
