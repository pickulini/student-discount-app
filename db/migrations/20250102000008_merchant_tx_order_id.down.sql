DROP INDEX IF EXISTS idx_merchant_tx_order_type;
ALTER TABLE merchant_transactions ADD CONSTRAINT merchant_transactions_order_id_key UNIQUE (order_id);
