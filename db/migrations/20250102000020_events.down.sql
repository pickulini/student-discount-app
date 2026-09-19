DROP INDEX IF EXISTS idx_event_attendees_user;
DROP INDEX IF EXISTS idx_event_attendees_event;
DROP TABLE IF EXISTS event_attendees;
DROP INDEX IF EXISTS idx_offers_organizer;
DROP INDEX IF EXISTS idx_offers_is_event;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_event_privacy_check;
ALTER TABLE offers
    DROP COLUMN IF EXISTS event_university_id,
    DROP COLUMN IF EXISTS event_privacy,
    DROP COLUMN IF EXISTS organizer_id,
    DROP COLUMN IF EXISTS is_event;
