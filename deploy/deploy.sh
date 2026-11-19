#!/usr/bin/env bash
# Runs on the VPS from the deploy directory (default /opt/sikesek), after
# GitHub Actions has copied compose.yaml, Caddyfile, deploy.sh and pushed the
# new images to GHCR.
#
# Required environment:
#   APP_IMAGE       full image ref, e.g. ghcr.io/felrfn/sikesek:sha
#   MIGRATE_IMAGE   full migrate image ref
# Optional:
#   APP_COMMIT      commit sha, exposed by /api/health
#   APP_DOMAIN      only used by compose; comes from .env

set -euo pipefail

cd "$(dirname "$0")"

: "${APP_IMAGE:?APP_IMAGE is required}"
: "${MIGRATE_IMAGE:?MIGRATE_IMAGE is required}"

if [[ ! -f .env ]]; then
  echo "error: .env not found in $(pwd)" >&2
  exit 1
fi
chmod 600 .env 2>/dev/null || true

export APP_IMAGE MIGRATE_IMAGE
if [[ -n "${APP_COMMIT:-}" ]]; then
  export APP_COMMIT
fi

previous_image="$(cat .app_image 2>/dev/null || true)"
printf '%s\n' "$APP_IMAGE" > .app_image

echo "==> Pulling images"
docker compose pull app migrate

echo "==> Applying database migrations"
# If this fails, the currently running app is left untouched.
docker compose run --rm migrate

echo "==> Starting app with ${APP_IMAGE}"
docker compose up -d --no-deps app

wait_healthy() {
  local id status
  for _ in $(seq 1 45); do
    id="$(docker compose ps -q app || true)"
    if [[ -n "$id" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id" 2>/dev/null || echo unknown)"
      if [[ "$status" == "healthy" ]]; then
        return 0
      fi
      if [[ "$status" == "exited" || "$status" == "dead" ]]; then
        return 1
      fi
    fi
    sleep 2
  done
  return 1
}

if ! wait_healthy; then
  echo "error: new container did not become healthy" >&2
  docker compose logs --tail=80 app >&2 || true
  if [[ -n "$previous_image" ]]; then
    echo "==> Rolling back to ${previous_image}" >&2
    printf '%s\n' "$previous_image" > .app_image
    APP_IMAGE="$previous_image" docker compose up -d --no-deps app || true
  fi
  exit 1
fi

echo "==> Applying Caddy configuration"
docker compose up -d caddy
docker compose exec -T caddy caddy reload \
  --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 \
  || docker compose restart caddy >/dev/null

echo "==> Cleaning old images (keep the 3 newest per repository)"
for repo in "${APP_IMAGE%:*}" "${MIGRATE_IMAGE%:*}"; do
  docker images "$repo" --format '{{.ID}}' \
    | awk '!seen[$0]++' \
    | tail -n +4 \
    | xargs -r docker rmi -f >/dev/null 2>&1 || true
done

echo "==> Deployed ${APP_IMAGE}"
