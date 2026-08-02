-- Add contact email to station settings (landing page contact section)
ALTER TABLE public.station_settings
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
