DROP INDEX IF EXISTS idx_referral_rewards_pending_available;
ALTER TABLE referral_rewards
    DROP COLUMN IF EXISTS cancelled_at,
    DROP COLUMN IF EXISTS available_at;
