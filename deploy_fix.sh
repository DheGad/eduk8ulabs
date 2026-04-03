#!/bin/bash
# ==========================================
# StreetMP OS — deploy_fix.sh
# Zero-Compromise Production Build Reset
# Run: chmod +x deploy_fix.sh && ./deploy_fix.sh
# ==========================================

set -euo pipefail
REPO="/var/www/streetmp-os"
LOG="/var/log/streetmp_deploy.log"
TS=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TS] $1" | tee -a "$LOG"; }

log "========================================"
log "  STREETMP OS — FULL BUILD RESET"
log "========================================"

cd "$REPO"

# ── Step 1: Pull latest code ──────────────────────────────────────────────────
log "[1/7] Pulling latest code..."
git pull origin main
log "      ✅ Code synced"

# ── Step 2: Wipe ALL stale .next build artifacts ──────────────────────────────
log "[2/7] Wiping stale .next caches..."
rm -rf "$REPO/apps/web/.next"
rm -rf "$REPO/apps/titan-hq/.next"
rm -rf "$REPO/apps/os-kernel/services/router-service/dist"
log "      ✅ Caches cleared"

# ── Step 3: Reinstall dependencies (clean) ───────────────────────────────────
log "[3/7] Installing dependencies (web)..."
cd "$REPO/apps/web"
npm ci --prefer-offline --no-audit
log "      ✅ Web deps installed"

log "      Installing dependencies (titan-hq)..."
cd "$REPO/apps/titan-hq"
npm ci --prefer-offline --no-audit
log "      ✅ Titan HQ deps installed"

log "      Installing dependencies (router-service)..."
cd "$REPO/apps/os-kernel/services/router-service"
npm ci --prefer-offline --no-audit
log "      ✅ Router service deps installed"

# ── Step 4: Build web ─────────────────────────────────────────────────────────
log "[4/7] Building apps/web (Next.js)..."
cd "$REPO/apps/web"
NODE_ENV=production npm run build
log "      ✅ Web build complete"

# ── Step 5: Build titan-hq ────────────────────────────────────────────────────
log "[5/7] Building apps/titan-hq (Next.js)..."
cd "$REPO/apps/titan-hq"
NODE_ENV=production npm run build
log "      ✅ Titan HQ build complete"

# ── Step 6: Build router-service ─────────────────────────────────────────────
log "[6/7] Building router-service (TypeScript)..."
cd "$REPO/apps/os-kernel/services/router-service"
npm run build
log "      ✅ Router service build complete"

# ── Step 7: PM2 memory-flush restart ─────────────────────────────────────────
log "[7/7] Restarting PM2 with memory flush..."
cd "$REPO"

pm2 stop all
pm2 flush         # Clear all log buffers
pm2 start ecosystem.config.js --env production
pm2 save

log "      ✅ PM2 restarted clean"

# ── Post-deploy health check ──────────────────────────────────────────────────
log "Running health checks..."
sleep 5

WEB_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://os.streetmp.com 2>/dev/null || echo "000")
LOGIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 https://os.streetmp.com/login 2>/dev/null || echo "000")
HEALTH=$(curl -s --max-time 10 https://os.streetmp.com/api/health 2>/dev/null || echo "{}")

log ""
log "  / → HTTP $WEB_CODE   $([ "$WEB_CODE" = "200" ] && echo '✅' || echo '❌')"
log "  /login → HTTP $LOGIN_CODE  $([ "$LOGIN_CODE" = "200" ] && echo '✅' || echo '❌')"
log "  /api/health → $HEALTH"
log ""

if [ "$LOGIN_CODE" = "200" ] && [ "$WEB_CODE" = "200" ]; then
    log "========================================"
    log "  🟢 DEPLOY COMPLETE — ALL SYSTEMS OK"
    log "========================================"
else
    log "========================================"
    log "  🔴 DEPLOY DONE — CHECK FAILED ROUTES"
    log "  Run: pm2 logs --lines 50"
    log "========================================"
fi

pm2 status
