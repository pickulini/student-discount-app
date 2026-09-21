DROP INDEX IF EXISTS idx_offers_base_price;
ALTER TABLE offers DROP COLUMN IF EXISTS base_price;
