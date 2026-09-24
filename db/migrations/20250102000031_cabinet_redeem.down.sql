ALTER TABLE offers DROP COLUMN IF EXISTS admin_edited_at;
ALTER TABLE offers DROP COLUMN IF EXISTS admin_edited_by;
ALTER TABLE offers DROP COLUMN IF EXISTS gallery;

DROP INDEX IF EXISTS idx_orders_redeemed_at;
DROP INDEX IF EXISTS idx_orders_redeem_code;
ALTER TABLE orders DROP COLUMN IF EXISTS redeemed_location_id;
ALTER TABLE orders DROP COLUMN IF EXISTS redeemed_by;
ALTER TABLE orders DROP COLUMN IF EXISTS redeemed_at;
ALTER TABLE orders DROP COLUMN IF EXISTS redeem_code;

DROP FUNCTION IF EXISTS gen_redeem_code();
