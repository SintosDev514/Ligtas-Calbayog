-- Migration 027: Auto-create notifications for new announcements

CREATE OR REPLACE FUNCTION notify_residents_new_announcement()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    rp.id,
    'announcement',
    'New PNP Announcement',
    NEW.title,
    jsonb_build_object('announcement_id', NEW.id)
  FROM resident_profiles rp
  WHERE rp.id IS NOT NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_announcement_insert ON announcements;

CREATE TRIGGER on_announcement_insert
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION notify_residents_new_announcement();
