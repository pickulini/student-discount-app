-- Просмотры страниц ивентов: для статистики организатора (охват, конверсия в «Пойду»).
-- Одна строка на пользователя в день — повторные открытия за день не накручивают счётчик.
CREATE TABLE IF NOT EXISTS event_views (
    event_id  BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
    user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewed_on DATE   NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (event_id, user_id, viewed_on)
);
CREATE INDEX IF NOT EXISTS idx_event_views_event_day ON event_views(event_id, viewed_on);
