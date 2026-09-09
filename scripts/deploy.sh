#!/bin/sh
set -eu

: "${IMAGE_TAG:?IMAGE_TAG is required}"
: "${PUBLIC_HEALTH_URL:?PUBLIC_HEALTH_URL is required}"

compose_files="-f docker-compose.production.yml -f docker-compose.deploy.yml"
previous_tag=""
if [ -f .last-successful-image ]; then
  previous_tag=$(sed -n '1p' .last-successful-image)
fi

rollback() {
  if [ -n "$previous_tag" ]; then
    echo "Readiness failed, rolling back to $previous_tag"
    IMAGE_TAG="$previous_tag" docker compose $compose_files up -d --no-build api web
  fi
}
trap rollback INT TERM HUP EXIT

docker compose $compose_files pull api api-migrate web
docker compose $compose_files run --rm api-migrate
docker compose $compose_files up -d --no-build api web

attempt=1
while [ "$attempt" -le 30 ]; do
  if curl --fail --silent --show-error "$PUBLIC_HEALTH_URL/api/health/ready" >/dev/null \
    && curl --fail --silent --show-error "$PUBLIC_HEALTH_URL/" >/dev/null; then
    printf '%s\n' "$IMAGE_TAG" > .last-successful-image
    trap - INT TERM HUP EXIT
    echo "Deployment $IMAGE_TAG is ready"
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "Readiness check failed"
exit 1
