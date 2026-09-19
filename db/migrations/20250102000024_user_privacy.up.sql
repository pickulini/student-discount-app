-- 10 полей видимости с дефолтом public
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS email_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS university_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS friends_list_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS subscribers_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS subscriptions_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS attending_events_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS organizing_events_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS offers_visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS statistics_visibility TEXT NOT NULL DEFAULT 'public';

-- CHECK-констрейнты
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_avatar_visibility_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_avatar_visibility_check
            CHECK (avatar_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_email_visibility_check
            CHECK (email_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_university_visibility_check
            CHECK (university_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_friends_list_visibility_check
            CHECK (friends_list_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_subscribers_visibility_check
            CHECK (subscribers_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_subscriptions_visibility_check
            CHECK (subscriptions_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_attending_events_visibility_check
            CHECK (attending_events_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_organizing_events_visibility_check
            CHECK (organizing_events_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_offers_visibility_check
            CHECK (offers_visibility IN ('public','friends','private'));
        ALTER TABLE users ADD CONSTRAINT users_statistics_visibility_check
            CHECK (statistics_visibility IN ('public','friends','private'));
    END IF;
END $$;

-- SQL-функция проверки: видно ли owner-поле viewer-у
CREATE OR REPLACE FUNCTION can_view(
    visibility TEXT,
    owner_id BIGINT,
    viewer_id BIGINT
) RETURNS BOOLEAN AS $$
    SELECT CASE
        WHEN visibility = 'public' THEN true
        WHEN visibility = 'private' THEN owner_id = viewer_id
        WHEN visibility = 'friends' THEN
            viewer_id > 0 AND EXISTS (
                SELECT 1 FROM friendships f
                WHERE f.status = 'accepted'
                  AND ((f.requester_id = owner_id AND f.addressee_id = viewer_id)
                    OR (f.requester_id = viewer_id AND f.addressee_id = owner_id))
            )
        ELSE false
    END
$$ LANGUAGE sql STABLE;
