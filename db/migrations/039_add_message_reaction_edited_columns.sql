-- Add reaction and edited columns to messages table
-- These columns are used by the chat UI for emoji reactions and edit tracking

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS reaction text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;
