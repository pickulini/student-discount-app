-- Админские правки оффера до подтверждения партнёром
ALTER TABLE offers
    ADD COLUMN IF NOT EXISTS admin_edited_data JSONB,
    ADD COLUMN IF NOT EXISTS admin_edit_comment TEXT,
    ADD COLUMN IF NOT EXISTS partner_reject_comment TEXT;

CREATE INDEX IF NOT EXISTS idx_offers_pending_partner
    ON offers(status) WHERE status = 'pending_partner_approval';
