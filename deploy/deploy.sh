#!/usr/bin/env bash
# ============================================================
# Despliega Finance PWA en el servidor propio (Docker Compose).
#
# Uso (desde la raíz del repo, en Git Bash):
#   ./deploy/deploy.sh
#
# Compila la PWA localmente, sube solo lo necesario por SSH y el
# servidor construye las imágenes y levanta el stack. La primera vez
# genera deploy/.env en el servidor con secretos aleatorios; después
# nunca lo toca.
# ============================================================
set -euo pipefail

SSH_TARGET="${SSH_TARGET:-suenos-dev@100.105.133.19}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_suenos}"
REMOTE_DIR="${REMOTE_DIR:-deploy/finance-pwa}" # relativo al home del servidor

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE="$(mktemp -d)"
trap 'rm -rf "$BUNDLE"' EXIT

ssh_run() { ssh -i "$SSH_KEY" -o BatchMode=yes "$SSH_TARGET" "$@"; }

echo "→ Compilando la PWA..."
(cd "$ROOT" && npm run build -- --configuration production)

echo "→ Armando el paquete..."
mkdir -p "$BUNDLE/deploy/web" "$BUNDLE/server" "$BUNDLE/dist/finance-pwa"
cp "$ROOT/.dockerignore" "$BUNDLE/"
cp "$ROOT/deploy/docker-compose.yml" "$ROOT/deploy/backup.sh" "$ROOT/deploy/.env.example" "$BUNDLE/deploy/"
cp "$ROOT/deploy/web/Dockerfile" "$ROOT/deploy/web/Caddyfile" "$BUNDLE/deploy/web/"
cp -r "$ROOT/server/src" "$ROOT/server/migrations" "$BUNDLE/server/"
cp "$ROOT/server/Dockerfile" "$ROOT/server/.dockerignore" "$ROOT/server/package.json" \
  "$ROOT/server/package-lock.json" "$BUNDLE/server/"
cp -r "$ROOT/dist/finance-pwa/browser" "$BUNDLE/dist/finance-pwa/"

echo "→ Subiendo a $SSH_TARGET:~/$REMOTE_DIR ..."
# Reemplaza el código pero conserva deploy/.env (secretos)
ssh_run "mkdir -p $REMOTE_DIR && cd $REMOTE_DIR && rm -rf server dist deploy/web"
tar -czf - -C "$BUNDLE" . | ssh_run "tar -xzf - -C $REMOTE_DIR"

echo "→ Construyendo y levantando contenedores..."
ssh_run "bash -s" <<EOF
set -euo pipefail
cd "$REMOTE_DIR"
chmod +x deploy/backup.sh
mkdir -p ~/backups/finance
if [ ! -f deploy/.env ]; then
  echo "  Generando deploy/.env con secretos nuevos"
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\nALLOW_SIGNUP=true\nWEB_PORT=8090\n' \
    "\$(openssl rand -hex 24)" "\$(openssl rand -hex 48)" > deploy/.env
fi
docker compose -f deploy/docker-compose.yml up -d --build --remove-orphans --wait --wait-timeout 180
docker image prune -f --filter label=com.docker.compose.project=finance > /dev/null
. deploy/.env
curl -fsS "http://127.0.0.1:\${WEB_PORT:-8090}/api/health" > /dev/null
echo "  API OK en http://127.0.0.1:\${WEB_PORT:-8090}"
EOF

echo "✔ Despliegue completo"
