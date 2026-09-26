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

Конфиги nginx лежат в `frontend/nginx/`:

- `main.conf` — главный конфиг (лимит соединений поднят до 16384 на процесс);
- `app.conf` — сайт: статика, `/api/`, `/payments/`, `/uploads/` и поток событий SSE;
- `http.conf` / `https.conf.template` — сервер без сертификата и с ним;
- `40-pick-site.sh` — при старте контейнера выбирает режим: есть сертификат в `./certs` → HTTPS, нет → HTTP.

Для потока событий (`/api/v1/notifications/stream`) критично `proxy_buffering off` и `gzip off` —
без них SSE рвётся каждые пару секунд.

После изменения конфигов — пересобрать frontend:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build frontend
```

---

## HTTPS (Tailscale, Let's Encrypt)

### Сейчас: Tailscale Funnel

На сервере включён Tailscale Funnel: он держит порт 443, сам выпускает и продлевает сертификат
на `server.<tailnet>.ts.net`, отдаёт сайт по HTTPS и HTTP/2 и публикует его в интернет.
Запросы Funnel передаёт в nginx на `http://127.0.0.1:80` с заголовком `X-Forwarded-Proto: https`.

```bash
tailscale funnel status         # что опубликовано
sudo tailscale funnel --bg 80   # опубликовать сайт (если выключен)
```

Свой сертификат в nginx при этом **не нужен**: `scripts/tls-cert.sh` видит Funnel и ничего не делает.

Чтобы сайт снаружи был доступен только через Funnel, в `.env.prod` можно задать
`HTTP_PORT=127.0.0.1:80` — тогда nginx не будет слушать 80-й порт на внешних адресах.

### Без Funnel: сертификат в nginx

Если Funnel/Serve выключен (`tailscale funnel reset`), сертификат можно выпустить в nginx:

```bash
sudo ./scripts/tls-cert.sh --install-cron
```

Скрипт кладёт `fullchain.pem`, `privkey.pem` и `host.txt` в `./certs` (в git не попадает) и
перезапускает frontend; nginx переключается на HTTPS + HTTP/2 (в `.env.prod` задайте `HTTPS_PORT=443`), с 80-го и
с IP-адреса — редирект 308 на имя из сертификата. Вернуться на HTTP — убрать файлы из `./certs`
и перезапустить frontend.

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
