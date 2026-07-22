#!/bin/sh
# Build the shared dispatch:latest image and (re)deploy tenant container(s)
# from it.
#   Usage: ./deploy.sh <tenant>      e.g. ./deploy.sh mbombela
#          ./deploy.sh all           build once, redeploy every tenant in ./tenants/
#
# NOTE: a docker build only moves the dispatch:latest tag - running containers
# keep the image they were started from. A tenant only picks up new code when
# its container is recreated, which is what "all" is for.
#
# Per-tenant ops values (container name, host port, API/env targets) live in
# ./tenants/<tenant>.env, sourced below. Branding (logo/watermark/display
# name) is NOT here - it lives in
# /home/res/dispatch-runtime-config/<tenant>/tenant-config.json, bind-mounted
# below, and is read at runtime (see src/hooks/use-tenant-config.ts). This
# keeps ONE image (dispatch:latest) shared across all tenants - tenants
# differ only by which files get bind-mounted into their container.
set -e

cd "$(dirname "$0")"

TENANT="$1"
if [ -z "$TENANT" ]; then
  echo "Usage: $0 <tenant>|all   (e.g. mbombela, mashishing)" >&2
  exit 1
fi

if [ "$TENANT" = "all" ]; then
  TENANTS=""
  for f in tenants/*.env; do
    TENANTS="$TENANTS $(basename "$f" .env)"
  done
else
  TENANTS="$TENANT"
fi

# Fail early, before building: every tenant needs its env file + runtime config.
for t in $TENANTS; do
  if [ ! -f "tenants/${t}.env" ]; then
    echo "No such tenant config: tenants/${t}.env" >&2
    exit 1
  fi
  if [ ! -f "/home/res/dispatch-runtime-config/${t}/tenant-config.json" ]; then
    echo "Missing /home/res/dispatch-runtime-config/${t}/tenant-config.json - create it before deploying." >&2
    exit 1
  fi
done

# Keep a per-tenant rollback tag pointing at the image each tenant runs now,
# then build the shared image once.
for t in $TENANTS; do
  docker tag dispatch:latest "dispatch:${t}-previous" 2>/dev/null || true
done
docker build -t dispatch:latest .

for t in $TENANTS; do
  # Subshell so one tenant's env vars can't leak into the next tenant's run.
  (
    . "tenants/${t}.env"
    RUNTIME_CONFIG_DIR="/home/res/dispatch-runtime-config/${t}"

    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true

    docker run -d \
      --name "$CONTAINER_NAME" \
      --restart unless-stopped \
      --network resgrid-setup_rgmain \
      -p "${HOST_PORT}:80" \
      -v "${RUNTIME_CONFIG_DIR}/tenant-config.json:/usr/share/nginx/html/tenant-config.json:ro" \
      -v /home/res/dispatch-runtime-config/call-description-type-map.json:/usr/share/nginx/html/call-description-type-map.json:ro \
      -e DISPATCH_REALTIME_GEO_HUB_NAME="${DISPATCH_REALTIME_GEO_HUB_NAME}" \
      -e DISPATCH_MAPBOX_PUBKEY="${DISPATCH_MAPBOX_PUBKEY}" \
      -e APP_ENV="${APP_ENV}" \
      -e DISPATCH_BASE_API_URL="${DISPATCH_BASE_API_URL}" \
      -e DISPATCH_RESGRID_API_URL="${DISPATCH_RESGRID_API_URL}" \
      -e DISPATCH_API_VERSION="${DISPATCH_API_VERSION}" \
      -e DISPATCH_CHANNEL_HUB_NAME="${DISPATCH_CHANNEL_HUB_NAME}" \
      dispatch:latest

    echo "Deployed ${CONTAINER_NAME} (tenant=${t}) from dispatch:latest."
    echo "To roll back: ./rollback.sh ${t}"
  )
done
