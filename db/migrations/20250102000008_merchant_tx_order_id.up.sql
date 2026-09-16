-- Убираем UNIQUE на order_id
ALTER TABLE merchant_transactions DROP CONSTRAINT IF EXISTS merchant_transactions_order_id_key;

-- Добавляем уникальный индекс на (order_id, type): один earning и один refund на заказ
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_tx_order_type 
    ON merchant_transactions(order_id, type) 
    WHERE order_id IS NOT NULL;
