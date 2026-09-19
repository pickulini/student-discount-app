CREATE TABLE IF NOT EXISTS notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    category        TEXT NOT NULL,       -- friends, events, offers, system
    title           TEXT NOT NULL,
    body            TEXT,
    link            TEXT,                -- /@username, /events/14, /orders/12
    actor_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reference_type  TEXT,
    reference_id    BIGINT,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_actor
    ON notifications(actor_id) WHERE actor_id IS NOT NULL;

-- Настройки уведомлений (добавляем в users для простоты)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_friends BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_events  BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_offers  BOOLEAN NOT NULL DEFAULT TRUE;
