### STAGE 1: Build ###
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Install dependencies needed for build
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies (increased timeout for slow networks/ARM64 builds)
RUN yarn install --frozen-lockfile --network-timeout 600000

# Copy source code
COPY . .

# Set environment for production web build
ENV APP_ENV=production
ENV NODE_ENV=production
ENV EXPO_PUBLIC_PLATFORM=web

# Build the web application
RUN yarn expo export --platform web

### STAGE 2: Serve ###
FROM nginx:1.25-alpine

# Install envsubst (part of gettext)
RUN apk add --no-cache gettext

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built web app from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy per-tenant branding assets (crests/watermarks), served statically.
# Which tenant a given running container actually displays is selected
# entirely by which tenant-config.json got bind-mounted at deploy time
# (see deploy.sh), not by anything in this image build.
COPY branding /usr/share/nginx/html/branding

# Copy the docker entrypoint script
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Set the entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]