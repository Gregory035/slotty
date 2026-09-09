#!/bin/sh
set -eu

: "${BACKUP_FILE:?BACKUP_FILE is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL must point to a disposable database}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found" >&2
  exit 1
fi

if [ -f "$BACKUP_FILE.sha256" ]; then
  sha256sum --check "$BACKUP_FILE.sha256"
fi

pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$BACKUP_FILE"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'SELECT COUNT(*) AS migrations FROM "_prisma_migrations";'
echo "Restore verification passed"
