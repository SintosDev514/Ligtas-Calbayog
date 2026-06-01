-- 010_resident_messaging.sql
-- Adds sender/receiver tracking for resident-to-resident messaging
-- Links family_contacts to auth.users for bidirectional messaging

ALTER TABLE family_contacts
ADD COLUMN IF NOT EXISTS contact_user_id uuid REFERENCES auth.users(id);

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS conversation_id text;

CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver
  ON messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender
  ON messages (receiver_id, sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_contacts_contact_user
  ON family_contacts (contact_user_id);

-- Enable Realtime for messages table (Supabase realtime subscriptions)
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
