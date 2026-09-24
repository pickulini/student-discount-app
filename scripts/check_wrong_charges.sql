-- Заказы, по которым списались лишние деньги из-за старой подстановки
-- «1000 ₽ по умолчанию» (исправлено в internal/usecase/order.go).
-- Только чтение: ничего не меняет.

-- 1) Бесплатные ивенты, за которые списали деньги. Возвращать полностью.
SELECT 'ивент' AS тип, o.id AS заказ, u.email, f.title AS ивент,
       o.total_amount AS списано, o.status, o.created_at
FROM orders o
JOIN offers f ON f.id = o.offer_id
JOIN users u ON u.id = o.user_id
WHERE f.is_event
  AND COALESCE(f.special_price, 0) = 0
  AND o.total_amount > 0
  AND o.status IN ('paid', 'completed')
ORDER BY o.created_at;

-- 2) Обычные предложения без цены (base_price = 0), проданные за «1000 ₽».
--    Реальной цены у них не было — решение о возврате принимайте вручную.
SELECT 'предложение без цены' AS тип, o.id AS заказ, u.email, f.title AS предложение,
       o.subtotal AS цена_в_заказе, o.total_amount AS списано, o.status, o.created_at
FROM orders o
JOIN offers f ON f.id = o.offer_id
JOIN users u ON u.id = o.user_id
WHERE NOT f.is_event
  AND COALESCE(f.base_price, 0) = 0
  AND o.subtotal = 1000
  AND o.status IN ('paid', 'completed')
ORDER BY o.created_at;
