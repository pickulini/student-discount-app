-- Касса партнёра: код погашения заказа и отметка о погашении.
-- Код в чеке студента выглядит как «0512 · KX7Q»: последние 4 цифры номера
-- заказа + 4 символа redeem_code.

CREATE OR REPLACE FUNCTION gen_redeem_code() RETURNS TEXT AS $$
DECLARE
    alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..4 LOOP
        result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS redeem_code TEXT;
UPDATE orders SET redeem_code = gen_redeem_code() WHERE redeem_code IS NULL;
ALTER TABLE orders ALTER COLUMN redeem_code SET DEFAULT gen_redeem_code();
ALTER TABLE orders ALTER COLUMN redeem_code SET NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS redeemed_by BIGINT REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS redeemed_location_id BIGINT REFERENCES company_locations(id);

CREATE INDEX IF NOT EXISTS idx_orders_redeem_code ON orders(redeem_code);
CREATE INDEX IF NOT EXISTS idx_orders_redeemed_at ON orders(redeemed_at);

-- Галерея предложения: дополнительные фото помимо обложки (image_url).
ALTER TABLE offers ADD COLUMN IF NOT EXISTS gallery TEXT[] NOT NULL DEFAULT '{}';

-- Кто и когда внёс правки модератора (экран «Правки от администратора»).
ALTER TABLE offers ADD COLUMN IF NOT EXISTS admin_edited_by BIGINT REFERENCES users(id);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS admin_edited_at TIMESTAMPTZ;
