#!/bin/sh
# Daily backup of the database and the uploaded files. Run from cron on the server, e.g.
#   15 2 * * *  /opt/agencyas/deploy/backup.sh >> /var/log/agencyas-backup.log 2>&1
# Keeps the last $KEEP_DAYS days in $BACKUP_DIR. Copy that folder to another machine as well:
# a backup on the same disk does not survive losing the disk.
set -eu

cd "$(dirname "$0")"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/agencyas}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F)"

mkdir -p "$BACKUP_DIR"
docker compose exec -T db pg_dump -U agencyas -d agencyas -Fc > "$BACKUP_DIR/db-$STAMP.dump"
docker compose exec -T web tar czf - -C /app/storage . > "$BACKUP_DIR/storage-$STAMP.tgz"

# refuse to prune if today's backup looks empty
[ -s "$BACKUP_DIR/db-$STAMP.dump" ] && [ -s "$BACKUP_DIR/storage-$STAMP.tgz" ] || { echo "$STAMP backup is empty"; exit 1; }
find "$BACKUP_DIR" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'storage-*.tgz' -mtime +"$KEEP_DAYS" -delete
echo "$STAMP backup ok: $(du -sh "$BACKUP_DIR" | cut -f1) in $BACKUP_DIR"
