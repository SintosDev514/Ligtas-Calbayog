-- Migration 026: Add announcement likes and comments

-- Likes table
CREATE TABLE IF NOT EXISTS announcement_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS announcement_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK to resident_profiles so PostgREST can join for user names
ALTER TABLE announcement_comments
  ADD CONSTRAINT fk_announcement_comments_resident
  FOREIGN KEY (user_id) REFERENCES resident_profiles(id)
  ON DELETE CASCADE
  NOT VALID;

-- RLS: announcement_likes
ALTER TABLE announcement_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
  ON announcement_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own likes"
  ON announcement_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON announcement_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS: announcement_comments
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON announcement_comments FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own comments"
  ON announcement_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON announcement_comments FOR DELETE
  USING (auth.uid() = user_id);
