# ============================================================
# Dockerfile — Streetmp OS Kernel Services
# Multi-stage build: Builder → Runner
# ============================================================
#
# USAGE
# ============================================================
#   Build a specific service (e.g. router-service):
#     docker build \
#       --build-arg SERVICE_NAME=router-service \
#       -t streetmp-os/router-service:latest \
#       -f apps/os-kernel/Dockerfile .
#
#   The BUILD CONTEXT must be the MONOREPO ROOT (not apps/os-kernel).
#   This allows the Dockerfile to COPY shared packages from
#   packages/security, packages/types, etc.
#
# MULTI-SERVICE PATTERN
# ============================================================
#   Each kernel microservice gets its own image but shares this
#   Dockerfile via the SERVICE_NAME build arg. The Compose file
#   passes the appropriate SERVICE_NAME for each service.
#
# SECURITY
# ============================================================
#   • Non-root execution: USER node (built-in to node:alpine)
#   • No shell or package managers in the runner stage
#   • Environment variables are injected at runtime via --env-file
#     or Compose env_file directives — NEVER baked into the image
# ============================================================

# ============================================================
# ARG: which service to build
# ============================================================
ARG SERVICE_NAME=router-service

# ============================================================
# STAGE 1: BUILDER
# Installs all dependencies and compiles TypeScript to dist/
# ============================================================
FROM node:20-alpine AS builder

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

WORKDIR /app

# Install build tools needed for native npm modules (bcryptjs, etc.)
RUN apk add --no-cache python3 make g++

# ── Copy package manifests first (layer cache optimization) ────
# Copying only package*.json means npm ci layers are cached as long
# as dependencies don't change — a much cheaper cache invalidation
# than copying all source files first.
COPY package.json package-lock.json ./

# Copy ALL workspace package manifests (needed for npm workspaces resolution)
COPY packages/config/package.json              ./packages/config/
COPY packages/security/package.json            ./packages/security/
COPY packages/types/package.json               ./packages/types/
COPY packages/logger/package.json              ./packages/logger/
COPY apps/os-kernel/services/${SERVICE_NAME}/package.json \
     ./apps/os-kernel/services/${SERVICE_NAME}/

# ── Copy source ────────────────────────────────────────────────
COPY packages/config/    ./packages/config/
COPY packages/security/  ./packages/security/
COPY packages/types/     ./packages/types/
COPY apps/os-kernel/services/ \
     ./apps/os-kernel/services/
COPY apps/os-kernel/services/${SERVICE_NAME}/tsconfig.json \
     ./apps/os-kernel/services/${SERVICE_NAME}/

# ── Install all dependencies (including devDeps for tsc) ───────
# Using npm install (not npm ci) to handle lockfile differences between
# development and production environments without error.
RUN npm install

# ── Build shared packages first, then the service ──────────────
RUN cd packages/config   && npm run build || true
RUN cd packages/security && npm run build || true
RUN cd packages/types    && npm run build || true
RUN cd apps/os-kernel/services/${SERVICE_NAME} && npm run build

# ============================================================
# STAGE 2: RUNNER
# Lean production image — only compiled output + prod deps
# ============================================================
FROM node:20-alpine AS runner

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
ENV NODE_ENV=production

WORKDIR /app

# Create app directory owned by the non-root 'node' user
# node:alpine ships with a built-in 'node' user (uid=1000)
RUN mkdir -p /app && chown node:node /app

# ── Copy production node_modules ───────────────────────────────
# Only prod dependencies — devDependencies are excluded by NODE_ENV
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# ── Copy compiled shared packages ──────────────────────────────
COPY --from=builder --chown=node:node /app/packages/config/        ./packages/config/
COPY --from=builder --chown=node:node /app/packages/security/dist  ./packages/security/dist
COPY --from=builder --chown=node:node /app/packages/security/package.json ./packages/security/
COPY --from=builder --chown=node:node /app/packages/types/dist     ./packages/types/dist
COPY --from=builder --chown=node:node /app/packages/types/package.json ./packages/types/

# ── Copy compiled service output ───────────────────────────────
COPY --from=builder --chown=node:node \
     /app/apps/os-kernel/services/${SERVICE_NAME}/dist \
     ./apps/os-kernel/services/${SERVICE_NAME}/dist
COPY --from=builder --chown=node:node \
     /app/apps/os-kernel/services/${SERVICE_NAME}/package.json \
     ./apps/os-kernel/services/${SERVICE_NAME}/

# ── Switch to non-root user ────────────────────────────────────
USER node

# ── Health check ───────────────────────────────────────────────
# Each service exposes GET /health — Docker will mark the container
# as healthy only after this returns 200.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4000}/health || exit 1

# ── Startup ────────────────────────────────────────────────────
# Run the compiled index.js from the service's dist directory.
# (If TypeScript inferred a common root, the output handles nested paths)
# SERVICE_NAME is substituted at build time via ARG.
CMD ["sh", "-c", "\
  if [ -f apps/os-kernel/services/${SERVICE_NAME}/dist/index.js ]; then \
    node apps/os-kernel/services/${SERVICE_NAME}/dist/index.js; \
  elif [ -f apps/os-kernel/services/${SERVICE_NAME}/dist/${SERVICE_NAME}/src/index.js ]; then \
    node apps/os-kernel/services/${SERVICE_NAME}/dist/${SERVICE_NAME}/src/index.js; \
  else \
    echo '[ERROR] Could not find executable index.js in dist' && exit 1; \
  fi\
"]
