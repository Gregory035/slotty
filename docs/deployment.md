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
