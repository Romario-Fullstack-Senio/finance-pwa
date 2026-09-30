#!/usr/bin/env bash
# ============================================================
# Backup de Finance PWA: base de datos (pg_dump) + fotos de perfil.
#
# Uso (en el servidor):
#   ~/deploy/finance-pwa/deploy/backup.sh [dias-a-retener]   # default 14
#
# Cron diario (crontab -e):
#   0 3 * * * ~/deploy/finance-pwa/deploy/backup.sh >> ~/backups/finance/backup.log 2>&1
# ============================================================
set -euo pipefail

RETENTION_DAYS="${1:-14}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/finance}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_FILE="$BACKUP_DIR/finance-db-$TIMESTAMP.sql.gz"
AVATARS_FILE="$BACKUP_DIR/finance-avatars-$TIMESTAMP.tar.gz"

mkdir -p "$BACKUP_DIR"
cd "$(dirname "$0")"
trap 'rm -f "$DB_FILE.partial" "$AVATARS_FILE.partial"' EXIT

docker compose -f docker-compose.yml exec -T db pg_dump -U finance finance | gzip > "$DB_FILE.partial"
mv "$DB_FILE.partial" "$DB_FILE"

docker run --rm -v finance_avatars:/avatars:ro alpine tar -czf - -C /avatars . > "$AVATARS_FILE.partial"
mv "$AVATARS_FILE.partial" "$AVATARS_FILE"

find "$BACKUP_DIR" -name 'finance-*.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Backup OK: $(basename "$DB_FILE"), $(basename "$AVATARS_FILE")"
