DROP INDEX IF EXISTS idx_offers_with_coords;
ALTER TABLE offers
    DROP COLUMN IF EXISTS place_name,
    DROP COLUMN IF EXISTS longitude,
    DROP COLUMN IF EXISTS latitude;
