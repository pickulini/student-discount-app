-- Ивенты = расширение оффера.
-- company_id делаем NULLABLE: у студенческих ивентов компании нет.
ALTER TABLE offers
    ALTER COLUMN company_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS is_event BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS organizer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS event_privacy TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS event_university_id BIGINT REFERENCES universities(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'offers_event_privacy_check') THEN
        ALTER TABLE offers ADD CONSTRAINT offers_event_privacy_check
            CHECK (event_privacy IN ('public','friends','subscribers','university','invite_only'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_offers_is_event ON offers(is_event) WHERE is_event = true;
CREATE INDEX IF NOT EXISTS idx_offers_organizer ON offers(organizer_id) WHERE organizer_id IS NOT NULL;

-- Участники ивентов (RSVP + запись после оплаты)
CREATE TABLE IF NOT EXISTS event_attendees (
    id         BIGSERIAL PRIMARY KEY,
    event_id   BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'going', -- going, interested, declined, cancelled
    order_id   BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
