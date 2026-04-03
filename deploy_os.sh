#!/bin/bash
# ==========================================
# StreetMP OS — Deep Clean Deploy
# Fixes: stale .next chunk caches + PM2 memory
# Usage: ./deploy_os.sh
# ==========================================

set -euo pipefail

REPO=$(pwd)
LOG="/var/log/streetmp_deploy.log"
TS=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TS] $1" | tee -a "$LOG"; }

log "============================================"
log "  STREETMP OS — DEEP CLEAN DEPLOY"
log "  $TS"
log "============================================"

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
log "[1/7] Pulling latest code..."
git pull origin main
log "      ✅ Code synced"

# ── Step 2: WIPE all stale .next builds (ROOT CAUSE FIX) ─────────────────────
# Without this, Next.js reuses old chunk hashes → browser gets 404s
log "[2/7] Wiping stale .next caches..."
rm -rf "$REPO/apps/web/.next"
rm -rf "$REPO/apps/titan-hq/.next"
log "      ✅ .next caches cleared"

# ── Step 3: Install + build apps/web ─────────────────────────────────────────
log "[3/7] Building apps/web..."
cd "$REPO/apps/web"
npm ci --prefer-offline --no-audit
NODE_ENV=production npm run build
log "      ✅ apps/web build complete"

# ── Step 4: Install + build apps/titan-hq ────────────────────────────────────
log "[4/7] Building apps/titan-hq..."
cd "$REPO/apps/titan-hq"
npm ci --prefer-offline --no-audit
NODE_ENV=production npm run build
log "      ✅ apps/titan-hq build complete"

# ── Step 5: Build router-service ─────────────────────────────────────────────
log "[5/7] Building router-service..."
cd "$REPO/apps/os-kernel/services/router-service"
npm ci --prefer-offline --no-audit
npm run build
log "      ✅ router-service build complete"

# ── Step 6: Hard PM2 restart (NOT reload — flushes memory) ───────────────────
log "[6/7] Restarting PM2 (hard restart + memory flush)..."
cd "$REPO"
pm2 stop all
pm2 flush
pm2 start ecosystem.config.js --env production
pm2 save
log "      ✅ PM2 restarted clean"

# ── Step 7: Restart Nginx to flush proxy cache ────────────────────────────────
log "[7/7] Restarting Nginx..."
systemctl restart nginx
log "      ✅ Nginx restarted"

# ── Post-deploy health checks ─────────────────────────────────────────────────
log "Running post-deploy health checks..."
sleep 5

LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://os.streetmp.com/login 2>/dev/null || echo "000")
HEALTH=$(curl -s --max-time 10 https://os.streetmp.com/api/health 2>/dev/null || echo "{}")

log ""
log "  /login → HTTP $LOGIN_CODE  $([ "$LOGIN_CODE" = "200" ] && echo '✅' || echo '❌ CHECK PM2 LOGS')"
log "  /api/health → $HEALTH"
log ""

if [ "$LOGIN_CODE" = "200" ]; then
    log "============================================"
    log "  🟢 DEPLOY COMPLETE — ALL SYSTEMS OK"
    log "============================================"
else
    log "============================================"
    log "  🔴 DEPLOY DONE — /login NOT 200"
    log "  Run: pm2 logs streetmp-web --lines 50"
    log "============================================"
fi

pm2 status
