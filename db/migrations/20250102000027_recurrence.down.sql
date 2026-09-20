DROP INDEX IF EXISTS idx_offers_recurring;
ALTER TABLE offers
    DROP COLUMN IF EXISTS recurrence_until,
    DROP COLUMN IF EXISTS recurrence_rule;
