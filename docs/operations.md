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

На сервере установите `ops/systemd/slotty-backup.service` и `ops/systemd/slotty-backup.timer` в `/etc/systemd/system`, затем выполните `systemctl daemon-reload && systemctl enable --now slotty-backup.timer`. По умолчанию архивы лежат в `./backups`, хранятся 14 дней и создаются также перед каждым deploy. Для off-site копии установите rclone, настройте зашифрованный remote и передайте `BACKUP_REMOTE`; без внешних реквизитов Slotty не может проверить удалённую копию автоматически.

## Инциденты

1. Зафиксировать request ID и время.
2. Проверить structured logs и метрики очередей.
3. При Telegram outage не отменять записи: delivery будет повторён.
4. При Redis outage production rate limiter работает fail-closed.
5. При компрометации refresh token — revoke all sessions; bot token — перевыпустить в BotFather и переподключить.
