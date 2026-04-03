#!/bin/bash
# ==========================================
# Phase 6: Full Stack Safe-Mode Startup
# ==========================================
# Starts the Frontend (3000), Kernel/Backend (4000), and HQ (5000)

set -e

echo "=== TITAN OS: FULL STACK STARTUP ==="

# Inject missing env vars to prevent backend crash
export STRIPE_SECRET_KEY="sk_test_placeholder"
export STREETMP_ADMIN_SECRET="streetmp_local_admin_secret_2026"
export DATABASE_URL="postgresql://streetmp:streetmp_dev_password@localhost:5432/streetmp_os?connect_timeout=5"
export VAULT_SERVICE_URL="http://localhost:4002"
export TITAN_BRIDGE_KEY="streetmp_local_bridge_secret_2026"
export NEXT_PUBLIC_TITAN_BRIDGE_KEY=$TITAN_BRIDGE_KEY

# 1. Start Main OS Dashboard (Frontend) on 3000
echo "[+] Starting Main OS Dashboard (Frontend) on Port 3000..."
(cd apps/web && npx next dev -H 0.0.0.0 -p 3000) &
FRONTEND_PID=$!

# 2. Start Router Service (Main OS Backend) on 4000
echo "[+] Starting Router Service (Main OS Backend) on Port 4000..."
(cd apps/os-kernel/services/router-service && npm run dev) &
BACKEND_PID=$!

# 3. Start Titan HQ on 5000
echo "[+] Starting Titan HQ on Port 5000..."
(cd apps/titan-hq && npx next dev -H 0.0.0.0 -p 5000) &
HQ_PID=$!

echo "[+] All systems nominal. Bound to 0.0.0.0. Press Ctrl+C to stop."

# Cleanup on exit
trap "echo 'Shutting down...'; kill $FRONTEND_PID $BACKEND_PID $HQ_PID; exit 0" SIGINT SIGTERM

wait
