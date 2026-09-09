# Архитектура

Проект — modular monolith: один NestJS API, один React SPA, PostgreSQL и Redis. Доменные модули не требуют микросервисной сети и разворачиваются одним compose.

## Модули backend

- `auth`, `companies`, `company-members` — identity и tenant context;
- `services`, `employees`, `scheduling` — каталог и рабочее время;
- `appointments`, `customers`, `dashboard` — booking domain;
- `telegram`, `notifications` — webhook queue, outbox и delivery;
- `billing` — планы, entitlements, payments;
- `audit`, `observability`, `health`, `rate-limit` — production concerns.

Запись создаётся только через единый `AppointmentsService`. PostgreSQL отвечает за tenant FK, idempotency и финальную защиту от пересечений. Workers выбирают задания через `FOR UPDATE SKIP LOCKED`, поэтому несколько экземпляров API не обрабатывают одну запись одновременно.

Frontend обращается только к `/api`, восстанавливает access token через HttpOnly refresh cookie и загружает разделы лениво.
