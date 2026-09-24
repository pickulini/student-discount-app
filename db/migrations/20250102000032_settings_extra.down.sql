ALTER TABLE users
    DROP COLUMN IF EXISTS searchable,
    DROP COLUMN IF EXISTS notify_orders,
    DROP COLUMN IF EXISTS notify_quiet;
