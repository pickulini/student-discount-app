#!/bin/sh
# Выбор режима при старте контейнера:
#   есть /etc/nginx/certs/fullchain.pem и privkey.pem → HTTPS + HTTP/2 (редирект с 80);
#   нет сертификата → обычный HTTP, как раньше.
# Имя сайта берём из PUBLIC_HOST, иначе из certs/host.txt (его пишет scripts/tls-cert.sh).
set -e
CERTS=/etc/nginx/certs
OUT=/etc/nginx/conf.d/default.conf

if [ -s "$CERTS/fullchain.pem" ] && [ -s "$CERTS/privkey.pem" ]; then
    HOST="${PUBLIC_HOST:-}"
    [ -z "$HOST" ] && [ -s "$CERTS/host.txt" ] && HOST=$(tr -d ' \r\n' < "$CERTS/host.txt")
    if [ -z "$HOST" ]; then
        echo "[site] сертификат есть, но имя сайта неизвестно (PUBLIC_HOST / certs/host.txt) — остаюсь на HTTP" >&2
        cp /etc/nginx/site/http.conf "$OUT"
        exit 0
    fi
    PUBLIC_HOST="$HOST" envsubst '${PUBLIC_HOST}' < /etc/nginx/site/https.conf.template > "$OUT"
    echo "[site] HTTPS для $HOST"
else
    cp /etc/nginx/site/http.conf "$OUT"
    echo "[site] сертификата нет — HTTP"
fi
