-- 011_get_contact_photos.sql
-- SECURITY DEFINER RPCs for profile lookups (bypass RLS)

CREATE OR REPLACE FUNCTION get_contact_photos(phones text[])
RETURNS TABLE(phone_number text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT phone_number, avatar_url
  FROM resident_profiles
  WHERE phone_number = ANY(phones)
    AND avatar_url IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION get_profile_by_id(uid uuid)
RETURNS TABLE(id uuid, full_name text, phone_number text, avatar_url text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, full_name, phone_number, avatar_url
  FROM resident_profiles
  WHERE id = uid
  LIMIT 1;
$$;
