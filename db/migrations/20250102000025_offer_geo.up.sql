-- Геолокация офферов и ивентов
ALTER TABLE offers
    ADD COLUMN IF NOT EXISTS latitude   DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude  DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS place_name TEXT;

-- Индекс для карты: показывать только офферы с координатами
CREATE INDEX IF NOT EXISTS idx_offers_with_coords
    ON offers(latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
