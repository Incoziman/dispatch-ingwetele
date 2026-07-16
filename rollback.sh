#!/bin/sh
# Roll dispatch-ingwetele back to the image tagged :previous by the last deploy.sh run.
set -e

docker stop dispatch-ingwetele 2>/dev/null || true
docker rm dispatch-ingwetele 2>/dev/null || true

docker run -d \
  --name dispatch-ingwetele \
  --restart unless-stopped \
  --network resgrid-setup_rgmain \
  -p 8081:80 \
  -v /home/res/dispatch-runtime-config/call-description-type-map.json:/usr/share/nginx/html/call-description-type-map.json:ro \
  -e DISPATCH_REALTIME_GEO_HUB_NAME=geolocationHub \
  -e DISPATCH_MAPBOX_PUBKEY=pk.eyJ1IjoiaW5jb3ppbWFuIiwiYSI6ImNtcjBncHNzZTBhaXcycHNieGRhZmFiMGsifQ.voGgLAXXs_EJIx6Z-JclZA \
  -e APP_ENV=production \
  -e DISPATCH_BASE_API_URL=https://api.mpulims.org \
  -e DISPATCH_API_VERSION=v4 \
  -e DISPATCH_RESGRID_API_URL=/api/v4 \
  -e DISPATCH_CHANNEL_HUB_NAME=eventingHub \
  dispatch-ingwetele:previous

echo "Rolled back to dispatch-ingwetele:previous."
