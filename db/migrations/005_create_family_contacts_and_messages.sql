-- 005_create_family_contacts_and_messages.sql

CREATE TABLE IF NOT EXISTS family_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  phone_number text NOT NULL,
  relationship text DEFAULT 'Friend',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_contacts_user ON family_contacts (user_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  contact_id uuid REFERENCES family_contacts(id) ON DELETE CASCADE NOT NULL,
  content text,
  message_type text DEFAULT 'text',
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages (contact_id, created_at DESC);
