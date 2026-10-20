#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${BACKUP_RETENTION_DAYS:=14}"

umask 077
mkdir -p "$BACKUP_DIR"
config_file=""
cleanup() {
  if [ -n "$config_file" ]; then rm -f "$config_file"; fi
}
trap cleanup EXIT INT TERM HUP
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
  rclone_args=""
  if [ -n "${RCLONE_CONFIG_BASE64:-}" ]; then
    config_file=$(mktemp)
    printf '%s' "$RCLONE_CONFIG_BASE64" | base64 -d > "$config_file"
    chmod 600 "$config_file"
    rclone_args="--config $config_file"
  fi
  # shellcheck disable=SC2086
  rclone $rclone_args copyto "$backup_file" "$BACKUP_REMOTE/$(basename "$backup_file")"
  # shellcheck disable=SC2086
  rclone $rclone_args copyto "$backup_file.sha256" "$BACKUP_REMOTE/$(basename "$backup_file.sha256")"
  # shellcheck disable=SC2086
  rclone $rclone_args size "$BACKUP_REMOTE/$(basename "$backup_file")" >/dev/null
fi
echo "$backup_file"
