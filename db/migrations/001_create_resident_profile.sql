-- Migration: Create resident_profile table
-- This table stores resident profile information linked to auth users

CREATE TABLE IF NOT EXISTS public.resident_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT,
  phone_number TEXT,
  address TEXT,
  emergency_contact TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.resident_profile ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.resident_profile;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.resident_profile;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.resident_profile;

-- Create RLS policies
-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile" 
ON public.resident_profile 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.resident_profile 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.resident_profile 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resident_profile_user_id 
ON public.resident_profile (user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.resident_profile TO authenticated;
