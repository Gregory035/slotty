#!/bin/sh
set -eu

: "${BACKUP_FILE:?Set an absolute path to a backup dump}"
case "$BACKUP_FILE" in /*) ;; *) echo 'Backup path must be absolute' >&2; exit 1;; esac
[ -f "$BACKUP_FILE" ] || { echo 'Backup not found' >&2; exit 1; }
: "${BACKUP_IMAGE:?Set the published Slotty backup image}"
name="slotty-restore-check-$(date +%s)-$$"
cleanup() { docker rm -fv "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM HUP
password=$(openssl rand -hex 24)
# No published ports or production network; the database exists only in this container.
docker run -d --name "$name" --network none --memory 512m \
  -e POSTGRES_PASSWORD="$password" -e POSTGRES_DB=slotty_restore \
  --mount "type=bind,source=$(dirname "$BACKUP_FILE"),target=/backups,readonly" \
  --entrypoint docker-entrypoint.sh "$BACKUP_IMAGE" postgres >/dev/null
attempt=0
until docker exec "$name" pg_isready -U postgres -d slotty_restore >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo 'Restore database did not start' >&2; exit 1; }
  sleep 1
done
docker exec -e "BACKUP_FILE=/backups/$(basename "$BACKUP_FILE")" \
  -e 'RESTORE_DATABASE_URL=postgresql:///slotty_restore?user=postgres' \
  "$name" /usr/local/bin/slotty-verify-backup
