# Booking flow

1. Клиент/панель выбирает service, employee и локальные дату/время.
2. `SchedulingService` проверяет tenant, assignment, horizon, notice, schedule, exceptions, buffers и существующие записи.
3. `EntitlementsService` проверяет подписку и месячный лимит.
4. Serializable transaction повторно проверяет slot, создаёт appointment snapshots, history и outbox.
5. Exclusion constraint запрещает пересечение даже при гонке между инстансами.
6. Outbox создаёт notification; worker отправляет Telegram независимо от booking transaction.

Dashboard creation использует `Idempotency-Key`. Telegram использует детерминированный ключ и уникальный `update_id`.

Допустимые переходы: `PENDING → CONFIRMED/CANCELLED_*`; `CONFIRMED → COMPLETED/NO_SHOW/CANCELLED_*`. Финальный статус нельзя открыть повторно. Перенос хранит старое/новое время и отменяет устаревшие reminders.
