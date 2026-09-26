# === Stage 1: build ===
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# === Stage 2: nginx ===
# HTTPS включается сам, если в /etc/nginx/certs смонтирован сертификат (см. scripts/tls-cert.sh),
# иначе сайт работает по HTTP, как раньше.
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/main.conf /etc/nginx/nginx.conf
COPY nginx/app.conf nginx/proxy.conf /etc/nginx/snippets/
COPY nginx/http.conf nginx/https.conf.template /etc/nginx/site/
COPY nginx/http.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 nginx/40-pick-site.sh /docker-entrypoint.d/40-pick-site.sh
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
