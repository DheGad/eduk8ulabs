# ============================================================
# policy-service Dockerfile
# Multi-stage build — matches v1/v2 kernel Dockerfile pattern
# ============================================================

FROM node:20-alpine AS builder

WORKDIR /workspace

COPY package*.json ./
COPY packages/config ./packages/config
COPY apps/os-kernel/services/policy-service ./apps/os-kernel/services/policy-service

RUN npm ci --workspace=apps/os-kernel/services/policy-service --workspace=packages/config
RUN cd apps/os-kernel/services/policy-service && npx tsc --project tsconfig.json

# ── Runner ────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /workspace/apps/os-kernel/services/policy-service/dist ./dist
COPY --from=builder /workspace/apps/os-kernel/services/policy-service/package.json ./package.json

RUN npm install --omit=dev && npm cache clean --force

USER node

EXPOSE 4008

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4008/health || exit 1

CMD ["node", "dist/index.js"]
