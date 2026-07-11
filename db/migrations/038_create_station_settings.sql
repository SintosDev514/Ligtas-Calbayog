-- Station settings table to store station profile (name, logo, phone, etc.)
CREATE TABLE IF NOT EXISTS public.station_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_name TEXT NOT NULL DEFAULT 'PNP Calbayog',
  profile_image_url TEXT,
  police_phone TEXT NOT NULL DEFAULT '117',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the singleton row if missing
INSERT INTO public.station_settings (station_name, police_phone)
SELECT 'PNP Calbayog', '117'
WHERE NOT EXISTS (SELECT 1 FROM public.station_settings);

-- Disable RLS — this is a public settings table with no sensitive data
ALTER TABLE public.station_settings DISABLE ROW LEVEL SECURITY;
