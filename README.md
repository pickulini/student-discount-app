# Student Discount Platform

Платформа студенческих скидок: офферы от партнёров, ивенты, друзья, подписки, поддержка.

---

## Стек

**Backend:** Go 1.22, chi router, pgxpool, PostgreSQL 16 (PostGIS), Redis 7
**Frontend:** React 19, Vite, TailwindCSS, Leaflet (карты), SSE (real-time)
**Инфра:** Docker, Docker Compose, Nginx, migrate (golang-migrate)

---

## Быстрый старт

### 1. Требования
- Docker Desktop
- Go 1.22+ (для локальной разработки без Docker)
- Node 20+ (для фронта)

### 2. Настройка

```bash
cp .env.example .env
# отредактируйте DATABASE_URL, JWT_SECRET при необходимости
Запуск локально
# поднять только инфру (Postgres + Redis)
make docker-up

# применить миграции
make migrate-up

# запустить API
make run
Запуск полностью в Docker (prod-режим)
cp .env.prod.example .env.prod
docker compose -f docker-compose.prod.yml up -d --build
Приложение будет доступно на http://localhost.
Структура проекта
.
├── cmd/
│   ├── api/                  # точка входа API
│   ├── backfill-usernames/   # CLI для генерации username
│   └── worker/               # воркеры (пока пусто)
│
├── internal/
│   ├── config/               # загрузка env
│   ├── domain/               # доменные модели и ошибки
│   ├── infrastructure/
│   │   └── crypto/           # хеш паролей, JWT
│   ├── repository/
│   │   ├── interfaces.go     # контракты репозиториев
│   │   └── postgres/         # реализации через pgxpool
│   ├── sse/                  # SSE Hub (real-time)
│   ├── transport/http/
│   │   ├── handlers/         # HTTP-хендлеры
│   │   ├── middleware/       # auth, cors, admin, logging
│   │   └── router_proto.go   # все роуты
│   ├── usecase/              # бизнес-логика
│   ├── util/                 # slugify, hashtags, translit
│   └── worker/               # фоновые воркеры
│
├── db/migrations/            # SQL-миграции (golang-migrate)
├── deployments/docker/       # Dockerfile API
├── frontend/                 # React SPA
└── docker-compose.prod.yml   # production stack
Основные команды
make run            # запуск API локально
make migrate-up     # применить миграции
make migrate-down   # откатить последнюю
make docker-up      # postgres + redis через docker
make docker-down    # остановить
make test           # go test ./...
Документация

API Reference — все эндпоинты, авторизация, примеры
Architecture — слои, паттерны, зависимости
Database — таблицы, связи, миграции
Development — как добавить фичу/роут/миграцию
Deployment — деплой на сервер, бэкапы, обновление
Роли

Роль	Права
student	Просмотр офферов, заказы, друзья, подписки, RSVP
merchant	+ управление своими офферами, ивентами, статистика
admin	Полный доступ: модерация, пользователи, поддержка
VIP-статус — флаг users.is_vip (платная подписка).

Real-time

SSE (/api/v1/notifications/stream):

уведомления (друзья, офферы, ивенты, поддержка)
chat-сообщения поддержки
бейджи модерации в админке
Клиент автопереподключается с экспоненциальным backoff.

Тестовые пользователи

Email	Пароль	Роль
admin_new@example.com	12345678	admin
partner3@example.com	12345678	merchant
check@example.com	12345678	student (verified)
Лицензия

Private
