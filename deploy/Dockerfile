# ==============================================================================
# V46 STREETMP OS: MULTI-STAGE DOCKERFILE
# strict-alpine / next.js standalone 
# ==============================================================================

# Base node image
FROM node:18-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy generic package manifests
COPY package.json package-lock.json ./
# For this repo, assuming standard npm workspace / turbo if applicable
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js telemetry disable across build
ENV NEXT_TELEMETRY_DISABLED 1

# If utilizing turborepo
RUN npm run build --if-present

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Security: Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy Next.js standalone output (Assumption: output: 'standalone' in next.config.js)
# If standalone is not explicitly configured, we copy the standard build layer
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Provide execution lock command
CMD ["npm", "start", "--workspace=web"]
