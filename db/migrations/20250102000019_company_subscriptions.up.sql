-- Подписки на компании (односторонние, без подтверждения)
CREATE TABLE IF NOT EXISTS company_subscriptions (
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_subs_company ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subs_user ON company_subscriptions(user_id);

-- Флаг: разрешена ли подписка на юзера (для будущих расширений, по дефолту true)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS privacy_allow_subscriptions BOOLEAN NOT NULL DEFAULT TRUE;
