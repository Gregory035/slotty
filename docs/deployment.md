# Deployment

## Подготовка VPS

Установите Docker Engine + Compose plugin, создайте каталог приложения и production `.env` с правами `600`. DNS/HTTPS рекомендуется завершать внешним reverse proxy (Caddy, Traefik либо managed load balancer).

Обязательные GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_APP_DIR`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`, `GHCR_USERNAME`, `GHCR_TOKEN`. Variable: `PUBLIC_HEALTH_URL`.

Workflow `.github/workflows/deploy.yml` публикует immutable images по commit SHA, копирует compose/deploy files, запускает отдельную migration image, проверяет readiness и откатывается к последнему успешному SHA.

## Ручной запуск

```bash
export GHCR_REPOSITORY=owner/repository
export IMAGE_TAG=commit-sha
export PUBLIC_HEALTH_URL=https://slotty.example.com
sh scripts/deploy.sh
```

Миграции только forward. Перед release делается backup. При несовместимой миграции откатывается приложение, данные восстанавливаются только по утверждённой restore-процедуре.

Branch protection для `main` должна требовать зелёный workflow `CI` и review — это настраивается в GitHub repository settings.

## Доверенная цепочка прокси

Production Compose рассчитан на единственный публичный вход: Caddy → web/Nginx → API.
Caddy по умолчанию заменяет клиентский `X-Forwarded-For`; Nginx дописывает адрес Caddy;
API использует `API_TRUST_PROXY_HOPS=2`. Порт API не публикуется, порт web привязан
только к `127.0.0.1`. Не открывайте API/web напрямую в интернет и не подключайте
недоверенные контейнеры к этой сети: более короткий путь позволит подделать IP.
При добавлении CDN/балансировщика необходимо заново настроить и проверить всю цепочку.
Для прямого локального API значение по умолчанию — `0` (заголовки клиента не доверенные).

Регрессии проверяются в CI на реальных Caddy, Nginx и Redis:

```bash
API_IMAGE=local-api-image WEB_IMAGE=local-web-image sh scripts/test-proxy-security.sh
```

Скрипт создаёт изолированную сеть и временные контейнеры, проверяет два независимых
клиентских IP, поддельные forwarded-заголовки, кеширование, CSP, noindex и лимит загрузки.
После теста удаляет только созданные им контейнеры и сеть. Рабочая БД не используется.
Защитные заголовки Nginx заданы на уровне server: не добавляйте `add_header` в отдельный
location без проверки наследования. Встраивание с web.telegram.org разрешено только Mini App.
