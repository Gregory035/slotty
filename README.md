# Telegram Business SaaS

[![CI](https://github.com/Gregory035/telegram-business-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/Gregory035/telegram-business-saas/actions/workflows/ci.yml)

SaaS-платформа для малого бизнеса: владелец управляет услугами, сотрудниками и расписанием, а клиенты записываются через фирменного Telegram-бота.

## Что реализовано

- регистрация и вход по JWT access/refresh tokens;
- компании с ролями `OWNER`, `ADMIN` и `EMPLOYEE`;
- изоляция данных компаний через `companyId` и guard-проверки;
- управление услугами и сотрудниками;
- рабочее расписание, исключения и расчет свободных слотов;
- управление записями клиентов;
- подключение Telegram-бота и сценарий бронирования;
- Swagger, health endpoint, smoke-скрипты и GitHub Actions CI.

## Архитектура и стек

Монорепозиторий и modular monolith:

- `apps/api` — NestJS, Prisma, PostgreSQL, Redis;
- `apps/web` — React, Vite, TypeScript;
- `docker-compose.yml` — локальные PostgreSQL и Redis;
- `.github/workflows/ci.yml` — typecheck, тесты и сборка.

В проекте используются RBAC, хеширование паролей, ротация refresh-токенов, AES-256-GCM для токенов ботов и транзакции для конкурентного бронирования.

## Локальный запуск

Требования: Node.js 22+, npm 10+, Docker Desktop.

```bash
cp .env.example .env
npm ci
docker compose up -d
npm run db:generate
npm run db:migrate
npm run dev
```

После запуска:

- Web: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3000/api](http://localhost:3000/api)
- Swagger: [http://localhost:3000/docs](http://localhost:3000/docs)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Проверки

```bash
npm run db:generate
npm run typecheck
npm test
npm run build
```

## Статус

Активно развиваемый pet-проект. Перед production-запуском потребуются дополнительное e2e-покрытие, наблюдаемость, усиление rate limiting и production-инфраструктура.
