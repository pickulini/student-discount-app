-- Настройки D61/D62: показ в поиске, уведомления о заказах, тихие часы.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS searchable    BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_orders BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS notify_quiet  BOOLEAN NOT NULL DEFAULT FALSE;
