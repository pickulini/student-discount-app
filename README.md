# Student Discount Platform

## Запуск локально
1. Скопируйте `.env.example` в `.env` и заполните.
2. `make docker-up` — поднимет PostgreSQL и Redis.
3. `make migrate-up` — применит миграции.
4. `make run` — запустит API.
5. Документация OpenAPI будет доступна по `/swagger` (позже).
