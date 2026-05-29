-- 003_add_emergency_contacts.sql

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert a default police contact for testing if not exists
INSERT INTO emergency_contacts (label, phone)
SELECT 'police', '23131'
WHERE NOT EXISTS (
  SELECT 1 FROM emergency_contacts WHERE label = 'police'
);

-- Optional index for quick lookup by label
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_label ON emergency_contacts (label);
