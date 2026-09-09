# API

Base URL: `/api`. Swagger доступен на `/docs` только когда `SWAGGER_ENABLED=true`.

## Auth

`POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/sessions/revoke-all`, `GET /auth/me`. Refresh token передаётся только cookie; остальные защищённые endpoints используют Bearer access token.

## Company resources

- `/companies/:companyId` — settings/delete;
- `/services`, `/employees`, `/employees/:employeeId/schedule`;
- `/availability`;
- `/appointments`, `/appointments/:id/reschedule|status|history`;
- `/customers`;
- `/dashboard`;
- `/bots`;
- `/members`;
- `/notifications`, `/audit-logs`;
- `/billing`, `/billing/payments`, `/billing/checkout`.

Списки appointments/customers/members/notifications/audit/payments возвращают `{ items, nextCursor, hasMore }`. Cursor opaque; клиент не должен разбирать его. Ошибка содержит `statusCode`, `message`, `requestId`. Конфликт slot/state — `409`, лимит — `429`, entitlement — `402`.

Для ручного `POST /appointments` отправляйте уникальный `Idempotency-Key` до 128 символов.
