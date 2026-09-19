DROP INDEX IF EXISTS idx_offers_pending_partner;
ALTER TABLE offers
    DROP COLUMN IF EXISTS partner_reject_comment,
    DROP COLUMN IF EXISTS admin_edit_comment,
    DROP COLUMN IF EXISTS admin_edited_data;
