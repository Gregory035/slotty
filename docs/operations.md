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

На сервере установите `ops/systemd/slotty-backup.service` и `ops/systemd/slotty-backup.timer` в `/etc/systemd/system`, затем выполните `systemctl daemon-reload && systemctl enable --now slotty-backup.timer`. По умолчанию архивы лежат в `./backups`, хранятся 14 дней и создаются также перед каждым deploy. Production-образ backup уже содержит rclone. Для off-site копии передайте `BACKUP_REMOTE` и, если remote не задаётся переменными `RCLONE_CONFIG_*`, base64-содержимое `rclone.conf` в `RCLONE_CONFIG_BASE64`. После загрузки скрипт проверяет доступность удалённого объекта; без внешних реквизитов включить эту проверку невозможно.

## Фотографии работ

По умолчанию изображения сохраняются в Docker volume. Для S3-совместимого хранилища задайте `WORK_EXAMPLES_STORAGE=s3`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, при необходимости `S3_ENDPOINT`, `S3_REGION` и `S3_FORCE_PATH_STYLE`. Ключи объектов не публикуются: изображения по-прежнему выдаёт API Slotty с проверкой допустимого идентификатора.

## Ошибки и Core Web Vitals

`SENTRY_DSN` включает отправку необработанных серверных ошибок в Sentry без персональных данных. `SENTRY_ENVIRONMENT` и `SENTRY_RELEASE` разделяют окружения и релизы. Полевые CLS, INP и LCP собираются только с согласия посетителя, только на публичных страницах и доступны в `/api/metrics` как `webVitals30Days`.

## Подписка

Первый платёж предлагает сохранить способ оплаты. После успешной оплаты автопродление можно включить или отключить в разделе «Тариф». За сутки до конца периода Slotty создаёт повторный платёж с идемпотентным ключом; неуспешный платёж переводит компанию в семидневный льготный период. Для фискального чека задайте корректный для вашей системы налогообложения `YOOKASSA_VAT_CODE` от 1 до 6. Без этого значения Slotty не передаёт объект `receipt`, чтобы не подставлять неверную налоговую ставку.

## Выпуск новой версии

После успешного CI для `main` workflow `Deploy production` собирает образы, выполняет резервное копирование и миграции, затем проверяет readiness. При неудачной проверке API и web возвращаются на последнюю рабочую версию. Ручной запуск workflow оставлен для повторного выпуска того же состояния.

## Инциденты

1. Зафиксировать request ID и время.
2. Проверить structured logs и метрики очередей.
3. При Telegram outage не отменять записи: delivery будет повторён.
4. При Redis outage production rate limiter работает fail-closed.
5. При компрометации refresh token — revoke all sessions; bot token — перевыпустить в BotFather и переподключить.
