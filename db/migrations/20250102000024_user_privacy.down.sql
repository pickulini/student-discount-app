DROP FUNCTION IF EXISTS can_view(TEXT, BIGINT, BIGINT);
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_statistics_visibility_check,
    DROP CONSTRAINT IF EXISTS users_offers_visibility_check,
    DROP CONSTRAINT IF EXISTS users_organizing_events_visibility_check,
    DROP CONSTRAINT IF EXISTS users_attending_events_visibility_check,
    DROP CONSTRAINT IF EXISTS users_subscriptions_visibility_check,
    DROP CONSTRAINT IF EXISTS users_subscribers_visibility_check,
    DROP CONSTRAINT IF EXISTS users_friends_list_visibility_check,
    DROP CONSTRAINT IF EXISTS users_university_visibility_check,
    DROP CONSTRAINT IF EXISTS users_email_visibility_check,
    DROP CONSTRAINT IF EXISTS users_avatar_visibility_check;

ALTER TABLE users
    DROP COLUMN IF EXISTS statistics_visibility,
    DROP COLUMN IF EXISTS offers_visibility,
    DROP COLUMN IF EXISTS organizing_events_visibility,
    DROP COLUMN IF EXISTS attending_events_visibility,
    DROP COLUMN IF EXISTS subscriptions_visibility,
    DROP COLUMN IF EXISTS subscribers_visibility,
    DROP COLUMN IF EXISTS friends_list_visibility,
    DROP COLUMN IF EXISTS university_visibility,
    DROP COLUMN IF EXISTS email_visibility,
    DROP COLUMN IF EXISTS avatar_visibility;
