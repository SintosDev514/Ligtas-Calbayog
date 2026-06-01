-- 009_get_user_by_phone.sql
-- SECURITY DEFINER RPC to look up a user by phone number (bypasses RLS)

CREATE OR REPLACE FUNCTION get_user_by_phone(phone text)
RETURNS TABLE(id uuid, full_name text, phone_number text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, full_name, phone_number
  FROM resident_profiles
  WHERE phone_number = phone
  LIMIT 1;
$$;
