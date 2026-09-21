ALTER TABLE offers
    ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2) NOT NULL DEFAULT 1000;

CREATE INDEX IF NOT EXISTS idx_offers_base_price ON offers(base_price);
