#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_RETENTION_DAYS:=14}"

umask 077
mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$BACKUP_DIR/slotty-$timestamp.dump"

pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
find "$BACKUP_DIR" -type f \( -name 'slotty-*.dump' -o -name 'slotty-*.dump.sha256' \) -mtime "+$BACKUP_RETENTION_DAYS" -delete

if [ -n "${BACKUP_REMOTE:-}" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "BACKUP_REMOTE is set, but rclone is unavailable" >&2
    exit 1
  fi
  rclone copyto "$backup_file" "$BACKUP_REMOTE/$(basename "$backup_file")"
  rclone copyto "$backup_file.sha256" "$BACKUP_REMOTE/$(basename "$backup_file.sha256")"
fi
echo "$backup_file"
