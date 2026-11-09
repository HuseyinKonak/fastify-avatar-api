# Stage 1: Dependencies & Build
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for modern package manager support
RUN corepack enable

# Install build dependencies (fontconfig is needed for some post-install scripts of sharp/fonts)
RUN apk add --no-cache fontconfig ttf-dejavu

# Install ALL dependencies for building
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune devDependencies for a lean production image
RUN npm prune --production

# Stage 2: Production
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

# Performance: Set NODE_ENV=production
ENV NODE_ENV=production

# Copy only necessary production node_modules and built artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy the fonts used by the renderer into the distroless image
COPY --from=builder /usr/share/fonts /usr/share/fonts
COPY --from=builder /etc/fonts /etc/fonts

# Map Fontconfig properly
ENV FONTCONFIG_PATH=/etc/fonts

USER nonroot

# Expose port
EXPOSE 8083

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/nodejs/bin/node", "dist/src/utils/healthcheck.js"]

ENTRYPOINT ["/nodejs/bin/node", "--max-old-space-size=1536", "dist/src/server.js"]
