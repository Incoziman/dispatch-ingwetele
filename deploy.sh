#!/bin/sh
# Build the shared dispatch:latest image and (re)deploy ONE tenant's
# container from it.
#   Usage: ./deploy.sh <tenant>      e.g. ./deploy.sh mbombela
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
  echo "Usage: $0 <tenant>   (e.g. mbombela, mashishing)" >&2
  exit 1
fi

TENANT_ENV="tenants/${TENANT}.env"
if [ ! -f "$TENANT_ENV" ]; then
  echo "No such tenant config: $TENANT_ENV" >&2
  exit 1
fi
. "$TENANT_ENV"

RUNTIME_CONFIG_DIR="/home/res/dispatch-runtime-config/${TENANT}"
if [ ! -f "${RUNTIME_CONFIG_DIR}/tenant-config.json" ]; then
  echo "Missing ${RUNTIME_CONFIG_DIR}/tenant-config.json - create it before deploying." >&2
  exit 1
fi

docker tag dispatch:latest "dispatch:${TENANT}-previous" 2>/dev/null || true
docker build -t dispatch:latest .

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
  -e DISPATCH_API_VERSION="${DISPATCH_API_VERSION}" \
  -e DISPATCH_RESGRID_API_URL="${DISPATCH_RESGRID_API_URL}" \
  -e DISPATCH_CHANNEL_HUB_NAME="${DISPATCH_CHANNEL_HUB_NAME}" \
  dispatch:latest

echo "Deployed ${CONTAINER_NAME} (tenant=${TENANT}) from dispatch:latest."
echo "To roll back: ./rollback.sh ${TENANT}"
