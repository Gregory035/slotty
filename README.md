# Telegram Business SaaS

SaaS-платформа для малого бизнеса: владелец настраивает компанию и собственного Telegram-бота, а клиенты записываются на услуги прямо в Telegram.

## Структура

- `apps/api` — NestJS API и Prisma;
- `apps/web` — React/Vite панель владельца;
- `docker-compose.yml` — PostgreSQL и Redis;
- `.github/workflows/ci.yml` — проверка сборки и тестов.

Архитектура backend — modular monolith. Все tenant-данные привязаны к `companyId`.

## Локальный запуск

Требования: Node.js 22+, npm 10+, Docker Desktop.

```bash
cp .env.example .env
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

После запуска:

- Web: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/docs
- Health: http://localhost:3000/api/health

## Ближайшие этапы

1. Регистрация, вход, access/refresh JWT.
2. Создание компании и проверка ролей OWNER/ADMIN/EMPLOYEE.
3. CRUD услуг и сотрудников.
4. Расписание и расчет свободных слотов.
5. Подключение Telegram-бота и сценарий записи.
