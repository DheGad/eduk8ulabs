FROM node:20-alpine AS builder
WORKDIR /workspace
COPY package*.json ./
COPY packages/config ./packages/config
COPY apps/os-kernel/services/workflow-service ./apps/os-kernel/services/workflow-service
RUN npm ci --workspace=apps/os-kernel/services/workflow-service --workspace=packages/config
RUN cd apps/os-kernel/services/workflow-service && npx tsc --project tsconfig.json

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /workspace/apps/os-kernel/services/workflow-service/dist ./dist
COPY --from=builder /workspace/apps/os-kernel/services/workflow-service/package.json ./package.json
RUN npm install --omit=dev && npm cache clean --force
USER node
EXPOSE 4009
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4009/health || exit 1
CMD ["node", "dist/index.js"]
