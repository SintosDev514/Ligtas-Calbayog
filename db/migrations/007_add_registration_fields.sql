-- 007_add_registration_fields.sql
-- Adds GPS coordinates and ID upload fields, creates OTP table

ALTER TABLE resident_profiles
ADD COLUMN IF NOT EXISTS latitude double precision,
ADD COLUMN IF NOT EXISTS longitude double precision,
ADD COLUMN IF NOT EXISTS id_photo_url text;

CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes (email, expires_at DESC);

CREATE OR REPLACE FUNCTION search_residents(search_term text)
RETURNS TABLE(full_name text, phone_number text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT full_name, phone_number
  FROM resident_profiles
  WHERE full_name ILIKE '%' || search_term || '%'
  LIMIT 10;
$$;
