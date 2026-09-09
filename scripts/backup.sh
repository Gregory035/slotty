#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

umask 077
mkdir -p "$BACKUP_DIR"
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_file="$BACKUP_DIR/telegram-business-$timestamp.dump"

pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
echo "$backup_file"
