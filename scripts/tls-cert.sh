#!/usr/bin/env bash
# HTTPS-сертификат для сервера из сети Tailscale (Let's Encrypt на имя *.ts.net).
#
#   sudo ./scripts/tls-cert.sh                 — выпустить/обновить сертификат и перезапустить nginx
#   sudo ./scripts/tls-cert.sh --install-cron  — то же + еженедельное автообновление (cron)
#
# Сертификат живёт 90 дней; tailscale обновляет его сам, когда до конца срока остаётся меньше трети.
# Файлы кладутся в ./certs (в git не попадают), nginx во фронтенд-контейнере подхватывает их сам.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CERTS="$ROOT/certs"
COMPOSE=(docker compose -f "$ROOT/docker-compose.prod.yml" --env-file "$ROOT/.env.prod")

if [ "$(id -u)" -ne 0 ]; then
    echo "Нужны права root: sudo $0 $*" >&2
    exit 1
fi

# Если HTTPS уже раздаёт Tailscale Funnel/Serve (он держит порт 443 и сам выпускает сертификат),
# свой сертификат в nginx не нужен: Funnel принимает HTTPS и передаёт запросы в nginx на порт 80.
if tailscale serve status 2>/dev/null | grep -q '^https://'; then
    echo "HTTPS уже обслуживает Tailscale Funnel/Serve:" >&2
    tailscale serve status >&2
    echo "Сертификат для nginx не нужен — ничего не делаю. (Отключить Funnel: tailscale funnel reset)" >&2
    exit 0
fi

# Имя сервера в сети Tailscale (например, server.tailXXXX.ts.net).
HOST="${PUBLIC_HOST:-$(tailscale status --json | tr -d ' \n' | grep -o '"CertDomains":\["[^"]*"' | cut -d'"' -f4 || true)}"
if [ -z "$HOST" ]; then
    echo "Не удалось узнать имя для сертификата. Включите HTTPS Certificates в панели Tailscale (DNS)" >&2
    echo "или передайте имя явно: sudo PUBLIC_HOST=server.xxx.ts.net $0" >&2
    exit 1
fi

mkdir -p "$CERTS"
before="$(cat "$CERTS/fullchain.pem" "$CERTS/host.txt" 2>/dev/null | md5sum || true)"

tailscale cert --cert-file "$CERTS/fullchain.pem" --key-file "$CERTS/privkey.pem" "$HOST"
echo "$HOST" > "$CERTS/host.txt"
chmod 644 "$CERTS/fullchain.pem" "$CERTS/host.txt"
chmod 600 "$CERTS/privkey.pem"

after="$(cat "$CERTS/fullchain.pem" "$CERTS/host.txt" | md5sum)"
if [ "$before" != "$after" ]; then
    echo "Сертификат для $HOST обновлён — перезапускаю nginx"
    # restart, а не reload: при первом выпуске nginx переключается с HTTP на HTTPS.
    "${COMPOSE[@]}" restart frontend >/dev/null 2>&1 || echo "(контейнер frontend не запущен — поднимите сайт командой deploy)"
else
    echo "Сертификат для $HOST ещё действителен — ничего не меняю"
fi

if [ "${1:-}" = "--install-cron" ]; then
    echo "17 4 * * 1 root $ROOT/scripts/tls-cert.sh >> /var/log/student-discount-cert.log 2>&1" > /etc/cron.d/student-discount-cert
    chmod 644 /etc/cron.d/student-discount-cert
    echo "Автообновление включено: каждый понедельник в 04:17 (/etc/cron.d/student-discount-cert)"
fi

echo "Готово: https://$HOST"
