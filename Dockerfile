# Multi-stage build for the monorepo.
#
# Why this Dockerfile instead of letting `fly launch` generate one: the app is an
# npm workspace with three packages. flyctl's Node detector would build
# apps/server alone and fail to resolve @dg/shared. This build copies the
# workspace manifests first (for layer caching), installs, compiles shared and
# server, then runs the compiled output with a production-only install.

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Manifests first: these change rarely, so the install layer stays cached.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# The web app is deployed as static files from the same origin, so it is
# installed too. If you later split the frontend onto Cloudflare Pages,
# drop apps/web here and publish dist/ from CI instead.
RUN npm ci

COPY tsconfig.json* ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
COPY apps/web ./apps/web

RUN npm run build -w @dg/shared \
 && npm run build -w @dg/server \
 && npm run build -w @dg/web

# Strip dev dependencies for the runtime layer.
RUN npm prune --omit=dev

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Run as the unprivileged user that ships with the node image.
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/packages/shared ./packages/shared
COPY --from=build --chown=node:node /app/apps/server ./apps/server
# Static build of the frontend, served by Fastify in production.
COPY --from=build --chown=node:node /app/apps/web/dist ./apps/web/dist

EXPOSE 8080

# /healthz is what fly.toml's health check polls.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/server/dist/index.js"]
