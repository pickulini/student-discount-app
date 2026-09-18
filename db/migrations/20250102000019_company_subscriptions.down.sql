DROP INDEX IF EXISTS idx_company_subs_user;
DROP INDEX IF EXISTS idx_company_subs_company;
DROP TABLE IF EXISTS company_subscriptions;
ALTER TABLE users DROP COLUMN IF EXISTS privacy_allow_subscriptions;
