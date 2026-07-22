#!/bin/sh
# Roll a tenant's container back to the image tagged :<tenant>-previous by
# the last deploy.sh run for that tenant.
#   Usage: ./rollback.sh <tenant>      e.g. ./rollback.sh mbombela
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
  "dispatch:${TENANT}-previous"

echo "Rolled back ${CONTAINER_NAME} (tenant=${TENANT}) to dispatch:${TENANT}-previous."
