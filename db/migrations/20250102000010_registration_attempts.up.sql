CREATE TABLE IF NOT EXISTS registration_attempts (
    id BIGSERIAL PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip_hash ON registration_attempts(ip_hash, created_at);
