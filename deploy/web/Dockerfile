# Contexto: raíz del repo (requiere `npm run build` antes)
FROM caddy:2-alpine

COPY deploy/web/Caddyfile /etc/caddy/Caddyfile
COPY dist/finance-pwa/browser /srv/app
