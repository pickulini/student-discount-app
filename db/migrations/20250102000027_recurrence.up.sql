-- Повторяющиеся ивенты (iCal RRULE)
ALTER TABLE offers
    ADD COLUMN IF NOT EXISTS recurrence_rule TEXT,
    ADD COLUMN IF NOT EXISTS recurrence_until TIMESTAMPTZ;

-- Индекс для поиска повторяющихся (опционально, для воркера в будущем)
CREATE INDEX IF NOT EXISTS idx_offers_recurring
    ON offers(recurrence_rule) WHERE recurrence_rule IS NOT NULL;
