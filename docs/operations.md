# Operations

## Health и метрики

- `/api/health/live` — процесс;
- `/api/health/ready` — PostgreSQL + Redis;
- `/api/metrics` — JSON metrics, `Authorization: Bearer $METRICS_TOKEN`.

Alert минимум: readiness 0, 5xx rate, p95 latency, `outboxPending`, `notificationsPending`, `telegramErrors`, `paymentErrors`, disk PostgreSQL.

## Backup

```bash
BACKUP_DIR=/secure/backups sh scripts/backup.sh
BACKUP_FILE=/secure/backups/<file>.dump sh scripts/verify-backup.sh
```

Запускайте backup ежедневно, шифруйте хранилище, держите минимум одну off-site копию. Restore drill — не реже раза в месяц в отдельную временную БД. Скрипт проверки не затрагивает production DB.

## Инциденты

1. Зафиксировать request ID и время.
2. Проверить structured logs и метрики очередей.
3. При Telegram outage не отменять записи: delivery будет повторён.
4. При Redis outage production rate limiter работает fail-closed.
5. При компрометации refresh token — revoke all sessions; bot token — перевыпустить в BotFather и переподключить.
