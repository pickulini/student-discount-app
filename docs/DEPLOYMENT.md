# Deployment

## Требования

- Сервер с Docker + Docker Compose v2
- Git
- Открытый порт 80 (или reverse proxy)

---

## Первый деплой

### 1. Клонировать

```bash
git clone <repo> ~/student-discount-app
cd ~/student-discount-app
```

### 2. Настроить `.env.prod`

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Заполнить:
```env
DB_USER=studentapp
DB_PASSWORD=сильный_пароль
DB_NAME=discount_db
JWT_SECRET=случайная_строка_64_символа
IP_HASH_SECRET=другая_случайная_строка
FRONTEND_URL=https://your-domain.com
HTTP_PORT=80
```

### 3. Создать папку для uploads

```bash
mkdir -p uploads
```

### 4. Запустить

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 5. Проверить

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api --tail=20
curl -I http://localhost
```

---

## Обновление

**Перед обновлением — бэкап БД!**

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U studentapp discount_db > ~/backup_$(date +%Y%m%d_%H%M%S).sql
```

```bash
cd ~/student-discount-app

# Подтянуть изменения
git fetch origin
git reset --hard origin/main

# Пересобрать образы
docker compose -f docker-compose.prod.yml build api frontend

# Применить миграции
docker compose -f docker-compose.prod.yml up migrate

# Перезапустить (без удаления volume)
docker compose -f docker-compose.prod.yml up -d --force-recreate api frontend
```

**Никогда:**
- ❌ `docker compose down -v` — удалит БД.
- ❌ `docker volume rm ..._postgres_data`
- ❌ `--force-recreate postgres` без нужды.

**Всегда:**
- ✅ `up -d --force-recreate api frontend` — только эти два.
- ✅ Бэкап перед изменениями.
- ✅ `up migrate` для применения миграций.

---

## Nginx и SSE

`frontend/nginx.conf` — критично для SSE:

```nginx
location = /api/v1/notifications/stream {
    proxy_pass http://api:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";

    gzip off;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
    chunked_transfer_encoding on;

    keepalive_timeout 0;
    proxy_connect_timeout 24h;
    proxy_read_timeout 24h;
    proxy_send_timeout 24h;
    send_timeout 24h;
}
```

**Без `proxy_buffering off` + `gzip off` SSE рвётся каждые 2 сек.**

После изменения `nginx.conf` — пересобрать frontend:
```bash
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d --force-recreate frontend
```

---

## HTTPS (Let's Encrypt)

Внешний nginx перед контейнерами:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Для SSE
        proxy_buffering off;
        proxy_read_timeout 24h;
    }
}
```

```bash
certbot --nginx -d your-domain.com
```

---

## Управление воркерами

Все воркеры стартуют в `main.go` при запуске API. Отдельных контейнеров нет.

```bash
# логи всех воркеров
docker compose -f docker-compose.prod.yml logs api | grep WORKER
docker compose -f docker-compose.prod.yml logs api | grep NOTIF_CLEANUP
docker compose -f docker-compose.prod.yml logs api | grep BONUS
docker compose -f docker-compose.prod.yml logs api | grep VIP
```

---

## Мониторинг

**Health-check:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/api/v1/offers
```

**Cron для мониторинга:**
```bash
*/5 * * * * curl -sf http://localhost/api/v1/offers > /dev/null || \
    echo "API down" | mail -s "Alert" admin@example.com
```

**Docker logs:**
```bash
docker compose -f docker-compose.prod.yml logs --tail=100 -f api
```

---

## Бэкапы

**Ежедневный бэкап через cron** — `/etc/cron.daily/my-app-backup.sh`:

```bash
#!/bin/bash
cd /home/user/student-discount-app
mkdir -p ~/backups
FILE=~/backups/db_$(date +%Y%m%d).sql
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U studentapp discount_db > $FILE
gzip $FILE
find ~/backups -name "db_*.sql.gz" -mtime +14 -delete
```

```bash
chmod +x /etc/cron.daily/my-app-backup.sh
```

---

## Восстановление БД

```bash
docker compose -f docker-compose.prod.yml stop api

docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U studentapp -d discount_db < backup_20250101_120000.sql

docker compose -f docker-compose.prod.yml start api
```

---

## Откат релиза

```bash
git log --oneline -10
git reset --hard <предыдущий_коммит>

docker compose -f docker-compose.prod.yml build api frontend
docker compose -f docker-compose.prod.yml up -d --force-recreate api frontend
```

**Откат миграции** (только последней):
```bash
docker run --rm -v $(pwd)/db/migrations:/migrations \
  --network host migrate/migrate \
  -path=/migrations \
  -database="postgres://studentapp:pass@localhost:5432/discount_db?sslmode=disable" \
  down 1
```

**Внимание:** миграции без `IF EXISTS` могут упасть при откате — проверь `.down.sql`.

---

## Проблемы

**`port 80 already in use`**
```bash
lsof -i :80
# изменить в .env.prod: HTTP_PORT=8080
```

**SSE не работает**
Проверить `nginx.conf` (см. выше). Пересобрать frontend.

**`connection refused` к БД**
```bash
docker compose -f docker-compose.prod.yml ps postgres
docker compose -f docker-compose.prod.yml logs postgres --tail=20
```

**Контейнер падает при старте**
```bash
docker compose -f docker-compose.prod.yml logs api --tail=50
```
Скорее всего миграция не применилась или SQL-ошибка.

**`no space left on device`**
```bash
docker system prune -a
du -sh /var/lib/docker/volumes/* | sort -h
```

---

## Полезные команды

```bash
# psql
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U studentapp -d discount_db

# зайти в контейнер
docker compose -f docker-compose.prod.yml exec api sh

# размер БД
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U studentapp -d discount_db -c "\l+"

# размер таблиц
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U studentapp -d discount_db -c "
    SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"
```

---

## Чек-лист деплоя

- [ ] Сделан бэкап БД
- [ ] `git pull` прошёл без конфликтов
- [ ] `docker compose build api frontend` успешен
- [ ] `up migrate` применил миграции
- [ ] `up -d --force-recreate api frontend` запущен
- [ ] Логи без ошибок (`logs api --tail=50`)
- [ ] Health-check отвечает 200
- [ ] SSE работает (F12 → Network → stream)
- [ ] Тестовый логин работает
