DROP INDEX IF EXISTS idx_notifications_actor;
DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_notifications_user_created;
DROP TABLE IF EXISTS notifications;
ALTER TABLE users
    DROP COLUMN IF EXISTS notify_offers,
    DROP COLUMN IF EXISTS notify_events,
    DROP COLUMN IF EXISTS notify_friends,
    DROP COLUMN IF EXISTS notify_enabled;
