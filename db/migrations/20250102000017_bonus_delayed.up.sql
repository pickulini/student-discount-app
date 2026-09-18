-- Отложенное зачисление реферальных наград (refund window 14 дней)
ALTER TABLE referral_rewards
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Индекс для воркера: находит pending-награды, готовые к зачислению
CREATE INDEX IF NOT EXISTS idx_referral_rewards_pending_available
    ON referral_rewards(available_at)
    WHERE status = 'pending';

-- Уже существующие credited-награды трогать не надо, они уже начислены.
-- Всем pending, которые остались в БД (если есть) — ставим available_at = NOW() + 14 дней,
-- чтобы воркер их подхватил.
UPDATE referral_rewards
SET available_at = COALESCE(available_at, created_at + INTERVAL '14 days')
WHERE status = 'pending' AND available_at IS NULL;
