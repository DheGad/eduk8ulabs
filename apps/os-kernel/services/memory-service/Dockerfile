# ============================================================
# memory-service Dockerfile
# Multi-stage build — matches the v1 kernel Dockerfile pattern
# ============================================================

# ── Stage 1: Builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy monorepo structure needed by the service
COPY package*.json ./
COPY packages/config ./packages/config
COPY apps/os-kernel/services/memory-service ./apps/os-kernel/services/memory-service

# Install dependencies (ci = exact lock-file install)
RUN npm ci --workspace=apps/os-kernel/services/memory-service --workspace=packages/config

# Compile TypeScript
RUN cd apps/os-kernel/services/memory-service && npx tsc --project tsconfig.json

# ── Stage 2: Runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as the built-in 'node' user, not root
WORKDIR /app

# Copy only compiled output and production node_modules
COPY --from=builder /workspace/apps/os-kernel/services/memory-service/dist ./dist
COPY --from=builder /workspace/apps/os-kernel/services/memory-service/package.json ./package.json

# Install only production deps in the runner stage
RUN npm install --omit=dev && npm cache clean --force

USER node

EXPOSE 4007

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4007/health || exit 1

CMD ["node", "dist/index.js"]
