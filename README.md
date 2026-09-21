# Student Discount Platform

Платформа студенческих скидок: офферы от партнёров, ивенты, друзья, подписки, поддержка.
Веб-приложение с real-time уведомлениями, чатом поддержки и админ-панелью.

---

## Стек

**Backend:** Go 1.22, chi router, pgxpool, PostgreSQL 16 + PostGIS, Redis 7
**Frontend:** React 19, Vite, TailwindCSS, Leaflet (карты), SSE (real-time)
**Инфра:** Docker Compose, Nginx, golang-migrate

---

## Возможности

### Для студентов
- Регистрация с автоопределением вуза по email-домену (`@msu.ru` → МГУ)
- Верификация студента
- Поиск и покупка офферов, оплата через СБП
- Скидки в зависимости от вуза
- Друзья, публичные профили, подписки на компании
- RSVP на ивенты (пойду / может быть), в том числе повторяющиеся
- Кошелёк, бонусы, реферальная программа
- Real-time уведомления

### Для партнёров
- Создание офферов и ивентов
- Хештеги, геолокация, картинки
- Модерация через админа, согласование правок
- Статистика: баланс, транзакции, топ офферов, топ ивентов, interested
- Управление компаниями

### Для админов
- Модерация офферов и ивентов с просмотром и редактированием
- Управление пользователями (роли, вузы, VIP-флаг)
- Верификации студентов
- Чат поддержки в реальном времени
- Управление тегами
- Аудит-логи
- Real-time бейджи «новые заявки на модерацию»

---

## Быстрый старт

### Требования
- Docker Desktop
- (опционально) Go 1.22+, Node 20+ — для локальной разработки без Docker

### Запуск локально

```bash
# 1. Конфиг
cp .env.example .env
# отредактировать DATABASE_URL, JWT_SECRET при необходимости

# 2. Поднять инфру (Postgres + Redis)
make docker-up

# 3. Применить миграции
make migrate-up

# 4. Запустить API
make run
```

### Запуск полностью в Docker (production)

```bash
cp .env.prod.example .env.prod
# заполнить DB_PASSWORD, JWT_SECRET, IP_HASH_SECRET, FRONTEND_URL

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Приложение будет доступно на `http://localhost`.

---

## Структура проекта

```
.
├── cmd/
│   ├── api/                  # точка входа API
│   ├── backfill-usernames/   # CLI: генерация username для существующих юзеров
│   └── worker/               # отдельные воркеры (резерв)
│
├── internal/
│   ├── config/               # загрузка env
│   ├── domain/               # доменные модели и ошибки
│   ├── infrastructure/
│   │   └── crypto/           # argon2id + JWT
│   ├── repository/
│   │   ├── interfaces.go     # контракты репозиториев
│   │   └── postgres/         # реализации (pgxpool)
│   ├── sse/                  # SSE Hub (in-memory pub/sub)
│   ├── transport/http/
│   │   ├── handlers/         # HTTP-хендлеры
│   │   ├── middleware/       # auth, cors, admin, merchant, audit
│   │   └── router_proto.go   # все роуты
│   ├── usecase/              # бизнес-логика
│   ├── util/                 # slugify, hashtags, translit
│   └── worker/               # фоновые воркеры
│
├── db/migrations/            # SQL-миграции (golang-migrate)
├── deployments/docker/       # Dockerfile API
├── frontend/                 # React SPA
├── docs/                     # документация
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
└── docker-compose.prod.yml   # production stack
```

---

## Команды

```bash
make run            # запуск API локально
make migrate-up     # применить миграции
make migrate-down   # откатить последнюю
make docker-up      # postgres + redis через docker
make docker-down    # остановить
make test           # go test ./...
```

### Сборка

```bash
go build ./...         # сборка всего
go vet ./...           # статический анализ
cd frontend && npm run build && cd ..
```

---

## Документация

| Файл | Что внутри |
|------|-----------|
| [docs/API.md](docs/API.md) | Все эндпоинты, авторизация, примеры, приватность, SSE |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Слои, паттерны, транзакции, nullable, SSE-хаб |
| [docs/DATABASE.md](docs/DATABASE.md) | Схема БД, индексы, миграции, SQL-функции |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Как добавить модель/роут/миграцию/приватность |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Деплой, HTTPS, бэкапы, troubleshooting |

---

## Роли

| Роль | Права |
|------|-------|
| `student` | Просмотр офферов, заказы, друзья, подписки, RSVP |
| `merchant` | + управление своими офферами, ивентами, статистика |
| `admin` | Полный доступ: модерация, пользователи, поддержка, теги |

VIP-статус — флаг `users.is_vip` + `users.vip_until`. Выдаётся после оплаты платной подписки.

---

## Real-time (SSE)

Единый стрим: `GET /api/v1/notifications/stream?token=<JWT>`

**События:**
- `notification` — персональное уведомление (друзья, офферы, ивенты, поддержка)
- `support_message` — новое сообщение в чате поддержки
- `new_support_ticket` — новый тикет админу
- `offer_pending_review` / `event_pending_review` — новая заявка на модерацию
- `verification_pending` — новая верификация

Клиент использует единый `NotificationProvider` (React Context) и автопереподключается с экспоненциальным backoff (1s → 30s). При reconnect состояние перезагружается через REST.

---

## Приватность

10 настраиваемых полей видимости с тремя уровнями (`public` / `friends` / `private`):
аватар, email, вуз, список друзей, подписчики компании, мои подписки,
планирую посетить, мои ивенты, мои офферы, статистика.

Проверка — на бэкенде через SQL-функцию `can_view()`, фильтрация применяется
в публичных эндпоинтах (`/users/by-username/{u}/*`, `/companies/{id}/stats`).

---

## Модерация

Офферы и ивенты проходят цепочку:

```
draft → pending_review → published / rejected
                       ↘ pending_partner_approval → published
```

Админ может редактировать оффер → партнёр согласовывает или отклоняет правки.
При отклонении оффер возвращается на модерацию с комментарием партнёра.

---

## Тестовые пользователи

| Email | Пароль | Роль |
|-------|--------|------|
| admin_new@example.com | 12345678 | admin |
| partner3@example.com | 12345678 | merchant |
| check@example.com | 12345678 | student (verified) |

---

## Безопасность

- Пароли — argon2id
- JWT access-токены (30 минут)
- Refresh-токены в `user_sessions`
- Rate limiting на регистрацию по IP-хешу
- Проверка referral cycle
- Аудит действий админов
- SQL-функция `can_view()` для приватности

---

## Лицензия

Private
