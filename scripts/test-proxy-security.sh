#!/bin/sh
set -eu
: "${API_IMAGE:?Set API_IMAGE to a built API runtime image}"
: "${WEB_IMAGE:?Set WEB_IMAGE to a built web runtime image}"
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
test_name="slotty-proxy-test-$$"
cleanup() {
  docker rm -fv "$test_name-client-a" "$test_name-client-b" "$test_name-caddy" "$test_name-web" "$test_name-api" "$test_name-redis" >/dev/null 2>&1 || true
  docker network rm "$test_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 1' INT TERM HUP
docker network create "$test_name" >/dev/null
docker run -d --name "$test_name-redis" --network "$test_name" --network-alias redis redis:7.4-alpine >/dev/null
docker run -d --name "$test_name-api" --network "$test_name" --network-alias api \
  -v "$project_dir/tests/proxy/upstream.cjs:/app/proxy-test.cjs:ro" \
  --entrypoint node "$API_IMAGE" /app/proxy-test.cjs >/dev/null
docker run -d --name "$test_name-web" --network "$test_name" --network-alias web \
  -p 127.0.0.1::8080 "$WEB_IMAGE" >/dev/null
docker run -d --name "$test_name-caddy" --network "$test_name" --network-alias caddy \
  -v "$project_dir/tests/proxy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine >/dev/null
proxy_port=$(docker port "$test_name-web" 8080/tcp | sed 's/.*://')
origin="http://127.0.0.1:$proxy_port"
attempt=0
until curl -fsS "$origin/" >/dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then docker logs "$test_name-web"; exit 1; fi
  sleep 1
done
docker exec "$test_name-web" nginx -t
SECURITY_PROXY_ORIGIN="$origin" node "$project_dir/scripts/smoke-security-headers.mjs"
UPLOAD_PROXY_ORIGIN="$origin" node "$project_dir/scripts/smoke-upload-proxy.mjs"
for client in a b; do
  # Keep both endpoints alive: Docker may reuse an exited container's IP.
  docker run -d --name "$test_name-client-$client" --network "$test_name" \
    -v "$project_dir/tests/proxy/client.mjs:/app/proxy-client.mjs:ro" \
    --entrypoint node "$API_IMAGE" -e 'setInterval(() => {}, 1000)' >/dev/null
done
for client in a b; do
  docker exec "$test_name-client-$client" node /app/proxy-client.mjs
done
