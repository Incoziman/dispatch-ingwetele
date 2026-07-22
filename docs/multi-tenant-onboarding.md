# Multi-Tenant Onboarding Guide

This document describes how Dispatch serves multiple branded, self-hosted deployments (e.g. `dispatch.mpulims.org` for Mbombela, `mashishing.mpulims.org` for Mashishing) from **one shared codebase and one shared Docker image**, all pointing at the same Resgrid core, and how to onboard a new one.

## Why this exists

Originally, a new city's branding (display name, crest/watermark) was hardcoded directly into `src/app/login/index.web.tsx` and shipped as its own tagged Docker image (`dispatch-<tenant>:latest`). That doesn't scale: every new tenant meant editing the same source file and rebuilding, risking one tenant's branding shipping to another tenant's container. This guide describes the replacement: one image, runtime-loaded per-tenant config, tenant differences expressed entirely through what gets bind-mounted into a container at deploy time.

## Architecture: the full request path

```
Browser
  → Cloudflare edge (public DNS CNAME to <tunnel-id>.cfargotunnel.com)
  → cloudflared daemon on the host (systemd service, config /etc/cloudflared/config.yml)
      ingress rule matches Host header → forwards to https://localhost:443
  → Caddy container (resgrid-setup-caddy-1, part of the separate `resgrid-setup`
    docker-compose stack, binds host 0.0.0.0:443)
      config /home/res/resgrid-setup/docker-data/caddy/Caddyfile
      routes purely on Host header (SNI is not used for routing)
      reverse_proxy's to the tenant's container BY DOCKER CONTAINER NAME
      (works because that container joins the same `resgrid-setup_rgmain`
      Docker network Caddy is on, so Docker's embedded DNS resolves it)
  → the tenant's Dispatch container (nginx inside), serving:
      - the Expo web static build (shared across all tenants)
      - /env-config.js (generated at container startup by
        scripts/docker-entrypoint.sh from DISPATCH_* env vars - API URLs,
        hub names, Mapbox key, etc. Shared core config, not branding.)
      - /tenant-config.json (bind-mounted per-tenant, read at runtime by
        src/hooks/use-tenant-config.ts - THIS is what makes branding differ
        between tenants)
      - /branding/<tenant>/*.png (crest/watermark images, baked into the
        shared image at build time via the Dockerfile, referenced by URL
        from tenant-config.json)
      - /call-description-type-map.json (bind-mounted, currently shared
        across all tenants since they share one Resgrid core)
```

All tenants share one Resgrid core (`api.mpulims.org`, one Postgres/Redis/RabbitMQ stack under `/home/res/resgrid-setup`) — a new tenant is a new **frontend**, not a new backend.

## How branding actually differs between tenants

`src/hooks/use-tenant-config.ts` fetches `/tenant-config.json` once at app boot (web only; native platforms and any fetch/parse failure silently fall back to a generic "Resgrid" default baked into `src/constants/tenantConfig.ts` — nothing ever crashes if the file is missing or malformed). `src/app/login/index.web.tsx` reads `displayName` and (optionally) `watermarkImageUrl` from it. That's the entire branding surface today — branding customization is web-only; the native login screen (`src/app/login/index.tsx`) has no branding text.

`tenant-config.json` shape:

```json
{
  "tenantId": "mashishing",
  "displayName": "Mashishing",
  "watermarkImageUrl": "/branding/mashishing/mashishing-crest-v1.png",
  "featureFlags": {}
}
```

`watermarkImageUrl` is optional — omit it entirely for a tenant with no crest yet (the watermark simply doesn't render, it doesn't show a broken image). `featureFlags` exists for future tenant-specific behavior differences but nothing reads it yet — no flags are defined; add real ones only when a tenant actually needs a functional (not just cosmetic) difference.

## Onboarding a new tenant: step by step

Say the new tenant is `newcity`, subdomain `newcity.mpulims.org`.

### 1. Pick a host port

Check what's already in use:

```sh
docker ps --format '{{.Names}} {{.Ports}}'
```

Dispatch tenants so far: `dispatch-ingwetele` (Mbombela) on 8081, `dispatch-mashishing` on 8083. Ports 8080/8082 belong to sibling apps (`unit-ingwetele`, `bigboard-ingwetele`), not Dispatch — don't reuse them. Pick the next free port for Dispatch (8084, then 8085, ...).

### 2. Create the tenant's env file (in this repo)

`tenants/newcity.env`:

```sh
CONTAINER_NAME=dispatch-newcity
HOST_PORT=8084
APP_ENV=production
DISPATCH_BASE_API_URL=https://api.mpulims.org
DISPATCH_API_VERSION=v4
DISPATCH_RESGRID_API_URL=/api/v4
DISPATCH_CHANNEL_HUB_NAME=eventingHub
DISPATCH_REALTIME_GEO_HUB_NAME=geolocationHub
DISPATCH_MAPBOX_PUBKEY=<same key as other tenants, unless this tenant needs its own>
```

Only the API/hub values need to change if this tenant's Resgrid core actually differs (it shouldn't, for tenants sharing `resgrid-setup`).

### 3. Create the tenant's branding config (on the host, NOT in git)

```sh
mkdir -p /home/res/dispatch-runtime-config/newcity
```

`/home/res/dispatch-runtime-config/newcity/tenant-config.json`:

```json
{
  "tenantId": "newcity",
  "displayName": "New City",
  "featureFlags": {}
}
```

Add `"watermarkImageUrl"` once you have a crest image (see step 4).

### 4. (Optional) Add a crest/watermark image

Put it in this repo at `branding/newcity/newcity-crest-v1.png`, then set `watermarkImageUrl` in the tenant-config above to `/branding/newcity/newcity-crest-v1.png`. It ships in the shared image via the Dockerfile's `COPY branding /usr/share/nginx/html/branding` line — every tenant's image lives in the same image, only `tenant-config.json` decides which one a given container actually references.

**Important:** these images get long-cached (1 year, `immutable`) by `nginx.conf`'s generic asset-cache rule. If a tenant's logo ever changes, ship it under a **new versioned filename** (`newcity-crest-v2.png`) and update `tenant-config.json` to match — never overwrite an existing filename in place, or browsers/Cloudflare's edge cache will keep serving the old image for up to a year.

### 5. Add the Caddy route

Append to `/home/res/resgrid-setup/docker-data/caddy/Caddyfile`:

```caddyfile
http://newcity.mpulims.org, https://newcity.mpulims.org {
  tls {$NGINX_LETSENCRYPT_EMAIL}
  reverse_proxy dispatch-newcity:80
}
```

Validate before reloading (a syntax error here affects every tenant, not just the new one):

```sh
docker exec resgrid-setup-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec resgrid-setup-caddy-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Reload is live and doesn't drop other tenants' traffic (confirmed empirically onboarding Mashishing).

### 6. Add the Cloudflare Tunnel ingress rule (needs root)

Edit `/etc/cloudflared/config.yml` (root-owned, `sudo` required), inserting a new entry **before** the trailing `- service: http_status:404` catch-all (ingress rules are first-match, order matters):

```yaml
  - hostname: newcity.mpulims.org
    service: https://localhost:443
    originRequest:
      noTLSVerify: true
      originServerName: api.mpulims.org
```

(`originServerName` is copied from the existing entries by convention — Caddy routes purely on the `Host` header, not SNI, so this value doesn't actually affect routing, just the TLS handshake against Caddy.)

Then restart the service:

```sh
sudo systemctl restart cloudflared
```

### 7. Register the public DNS record

This doesn't need root — it uses the tunnel's credentials file directly:

```sh
cloudflared tunnel route dns ce3dd4e5-4c71-4936-84db-488f4d167e3c newcity.mpulims.org
```

(Tunnel ID is specific to this host; check `/etc/cloudflared/config.yml`'s `tunnel:` line if it ever changes.)

### 8. Deploy the container

From `~/Dispatch`:

```sh
./deploy.sh newcity
```

This builds the shared `dispatch:latest` image (if source changed) and (re)starts `dispatch-newcity` with the tenant's env values and bind mounts. To roll back to the previous build for this tenant only: `./rollback.sh newcity`.

Note: rebuilding the image does **not** update already-running containers — each tenant only picks up new code when its container is recreated. To ship a code change to every tenant at once (build once, restart all): `./deploy.sh all`.

### 9. Verify end-to-end

```sh
# Container is healthy and serving the right tenant config:
docker exec dispatch-newcity cat /usr/share/nginx/html/tenant-config.json

# Routes correctly through Caddy (works even before public DNS propagates):
curl -sk --resolve newcity.mpulims.org:443:127.0.0.1 https://newcity.mpulims.org/tenant-config.json

# Fully public path (Cloudflare → cloudflared → Caddy → container):
curl -s https://newcity.mpulims.org/tenant-config.json
```

All three should return the new tenant's JSON. Load `https://newcity.mpulims.org/login` in a real browser to see the rendered branding (the JSON checks above only confirm the file is served — the display name/watermark only render after the JS bundle loads and fetches it client-side).

## Gotchas / things that aren't obvious

- **Permission boundaries, if using an AI coding assistant to do this**: editing files outside the `~/Dispatch` repo (i.e. the Caddyfile under `~/resgrid-setup`) may get blocked by the assistant's own safety classifier and need a human to do it directly. Editing `/etc/cloudflared/config.yml` and restarting the service needs root, which an assistant session typically won't have non-interactively. Steps 5 (Caddyfile) and 6 (cloudflared) are the two most likely to need a human's hands directly.
- **Branding is web-only.** The native mobile login screen has no tenant branding today. If that's ever needed, it's new work, not covered by this mechanism.
- **`featureFlags` in tenant-config.json is currently just a placeholder.** Nothing reads it. Don't build speculative flag-checking logic until a tenant actually needs a specific functional difference — add the flag and its one call site together, when needed.
- **The `call-description-type-map.json` bind mount is shared across all tenants today** (same host file, same path, for every tenant's `deploy.sh` run). If a tenant needs its own mapping, give it its own file under `/home/res/dispatch-runtime-config/<tenant>/` and update that tenant's line in `deploy.sh`'s mount args (currently hardcoded to the shared path — would need a small parameterization if this is ever needed).
- **Ports 8080/8082 are sibling Resgrid apps** (`unit-ingwetele`, `bigboard-ingwetele`), not other Dispatch tenants — don't confuse them when picking the next free port.
