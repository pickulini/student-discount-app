# Database

PostgreSQL 16 + PostGIS. Миграции — golang-migrate.

---

## Таблицы

### users
Ключевые поля: `id`, `email`, `password_hash` (argon2id), `full_name`, `nickname`,
`username` (UNIQUE lower), `avatar_url`, `university_id`, `course`, `birth_date`,
`student_status` (pending/verified/expired), `referral_code`, `referred_by`,
`role` (student/merchant/admin), `balance`, `is_active`, `is_vip`, `vip_until`.

**Приватность:** `privacy_allow_subscriptions`, `notify_enabled/friends/events/offers`,
`avatar_visibility`, `email_visibility`, `university_visibility`,
`friends_list_visibility`, `subscribers_visibility`, `subscriptions_visibility`,
`attending_events_visibility`, `organizing_events_visibility`, `offers_visibility`,
`statistics_visibility` (все text: `public/friends/private`).

### companies
`id, name, description, logo_key, website, phone, category_id, is_active`.

### company_users
Связь партнёров с компаниями. `id, user_id, company_id, role`.

### offers
Основная таблица и для офферов, и для ивентов.
`company_id` nullable (для студенческих ивентов).

Статусы: `draft / pending_review / pending_partner_approval / published / rejected / archived / expired`.

Event-поля: `is_event`, `organizer_id`, `event_privacy`, `event_university_id`,
`recurrence_rule`, `recurrence_until`.

Geo: `latitude`, `longitude`, `place_name`.

Админские правки: `admin_edited_data` (JSONB), `admin_edit_comment`, `partner_reject_comment`.

### tags / offer_tags
M2M. `tags.status` — `pending/active/rejected`.
При публикации оффера pending-теги становятся active.

### orders
`id, user_id, company_id (nullable), location_id, offer_id, subtotal, discount_amount,
bonus_amount, total_amount, commission, status, created_at, completed_at, cancelled_at`.

Статусы: `created, paid, completed, cancelled, refunded, failed`.

### accounts
`id, user_id, type (cash), currency, balance, status`.

### bonus_accounts / bonus_transactions
Типы: `referral_reward, purchase_bonus, spend, refund, expiration`.

### ledger_transactions / ledger_entries
Двойная запись. `entry.amount` положительный = кредит, отрицательный = дебет.

### merchant_accounts / merchant_transactions / settlements
Финансы мерчанта.
`merchant_transactions` — UNIQUE `(order_id, type)` для идемпотентности.

### friendships
`requester_id, addressee_id, status, created_at, updated_at`.
Уникальный индекс пары `(LEAST, GREATEST)` для активных статусов.

### company_subscriptions
PK `(user_id, company_id)`. Односторонняя подписка.

### event_attendees
`event_id, user_id, status (going/interested/declined/cancelled), order_id`.
UNIQUE `(event_id, user_id)`.

### notifications
`user_id, type, category, title, body, link, actor_id, reference_type, reference_id,
read_at, created_at`.

### support_tickets / support_messages

### referral_invites / referral_rewards
`referral_rewards.available_at` — когда награду можно зачислить.

### payments
Платежи через СБП.

### student_verifications
Верификации студентов.

### user_sessions
Refresh-токены.

### audit_logs

### registration_attempts
Антифрод по IP-хешу.

### universities
`id, name, short_name, domains (jsonb), is_active`.
`domains` — массив email-доменов: `["msu.ru", "mail.msu.ru"]`.

### schema_migrations
Служебная таблица golang-migrate.

---

## SQL-функция can_view

```sql
CREATE FUNCTION can_view(visibility TEXT, owner_id BIGINT, viewer_id BIGINT)
RETURNS BOOLEAN AS $$
    SELECT CASE
        WHEN visibility = 'public' THEN true
        WHEN visibility = 'private' THEN owner_id = viewer_id
        WHEN visibility = 'friends' THEN
            viewer_id > 0 AND EXISTS (
                SELECT 1 FROM friendships f
                WHERE f.status = 'accepted'
                  AND ((f.requester_id = owner_id AND f.addressee_id = viewer_id)
                    OR (f.requester_id = viewer_id AND f.addressee_id = owner_id))
            )
        ELSE false
    END
$$ LANGUAGE sql STABLE;
```

Используется в `GetPublicProfileByUsernameWithViewer`.

---

## Миграции

Формат: `YYYYMMDDHHMMSS_name.up.sql` / `.down.sql` в `db/migrations/`.
Применяются автоматически контейнером `migrate` в compose.

```bash
VERSION=$(date +%Y%m%d%H%M%S)

cat > db/migrations/${VERSION}_my_change.up.sql << 'EOF'
ALTER TABLE users ADD COLUMN bio TEXT;
EOF

cat > db/migrations/${VERSION}_my_change.down.sql << 'EOF'
ALTER TABLE users DROP COLUMN bio;
EOF

docker compose -f docker-compose.prod.yml up migrate
```

**Никогда не редактируй применённые миграции.**

---

## Индексы

- `users_username_key` UNIQUE (lower(username))
- `idx_users_email`
- `idx_tags_slug_lower`
- `idx_offers_status`, `idx_offers_company_id`
- `idx_offers_is_event` (partial)
- `idx_offers_with_coords` (partial)
- `idx_offers_recurring` (partial)
- `idx_friendships_pair_active` UNIQUE
- `idx_notifications_user_unread` (partial)

---

## Полезные запросы

```sql
-- топ ивентов по посещаемости
SELECT o.id, o.title, COUNT(ea.id) AS going
FROM offers o
LEFT JOIN event_attendees ea ON ea.event_id = o.id AND ea.status = 'going'
WHERE o.is_event = true AND o.status = 'published'
GROUP BY o.id ORDER BY going DESC LIMIT 5;

-- юзеры без username
SELECT id, email FROM users WHERE username IS NULL;

-- дубли хештегов
SELECT LOWER(name), COUNT(*) FROM tags GROUP BY LOWER(name) HAVING COUNT(*) > 1;
```

---

## Бэкап

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U studentapp discount_db > backup_$(date +%Y%m%d_%H%M%S).sql

docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U studentapp -d discount_db < backup_20250101_120000.sql
```
