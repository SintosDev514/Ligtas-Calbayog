-- 006_add_guardian_fields.sql

ALTER TABLE resident_profiles
ADD COLUMN IF NOT EXISTS guardian_name text,
ADD COLUMN IF NOT EXISTS guardian_phone text,
ADD COLUMN IF NOT EXISTS father_phone text,
ADD COLUMN IF NOT EXISTS mother_phone text;

-- Make father_name and mother_name nullable (optional)
-- (They were already optional since no NOT NULL constraint was set)
