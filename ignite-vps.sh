#!/usr/bin/env bash
# ============================================================
# ignite-vps.sh — StreetMP OS V52 VPS Ignition Script
# Run this on the server AFTER uploading the ZIP:
#   bash /root/ignite-vps.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

DEPLOY_DIR="/var/www/streetmp-os"
ZIP_PATH="/root/StreetMP_OS_V52_Backup.zip"

echo -e "${BLUE}${BOLD}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║      StreetMP OS V52 — VPS Ignition Sequence             ║"
echo "║      Zero-Trust Sovereign Infrastructure Deployment       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Step 1: System dependencies ────────────────────────────
echo -e "${BOLD}[1/6] Installing system dependencies...${RESET}"
apt-get update -qq
apt-get install -y -qq unzip curl wget git

# Install Docker if not present
if ! command -v docker &>/dev/null; then
  echo "  Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "${GREEN}  ✓ Docker installed${RESET}"
else
  echo -e "${GREEN}  ✓ Docker already installed: $(docker --version)${RESET}"
fi

echo ""

# ── Step 2: Extract payload ────────────────────────────────
echo -e "${BOLD}[2/6] Extracting StreetMP OS V52 payload...${RESET}"

if [[ ! -f "$ZIP_PATH" ]]; then
  echo -e "${RED}✗ ZIP not found at $ZIP_PATH. SCP may have failed.${RESET}"
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
unzip -o "$ZIP_PATH" -d "$DEPLOY_DIR"
echo -e "${GREEN}  ✓ Payload extracted to $DEPLOY_DIR${RESET}"

cd "$DEPLOY_DIR"
echo ""

# ── Step 3: Environment setup ──────────────────────────────
echo -e "${BOLD}[3/6] Setting up production environment...${RESET}"

if [[ ! -f ".env.prod" ]]; then
  echo -e "${YELLOW}  ⚠  No .env.prod found. Creating template...${RESET}"
  cat > .env.prod <<'ENVTEMPLATE'
# ============================================================
# StreetMP OS V52 — Production Environment
# Fill in ALL values before running docker compose
# ============================================================

# Database
DB_USER=streetmp
DB_PASS=CHANGE_THIS_STRONG_PASSWORD
DB_NAME=streetmp_os

# Redis
REDIS_PASSWORD=CHANGE_THIS_REDIS_PASSWORD

# JWT & Secrets
JWT_SECRET=CHANGE_THIS_64_CHAR_HEX_SECRET
VAULT_MASTER_KEY=CHANGE_THIS_VAULT_KEY
INTERNAL_ROUTER_SECRET=CHANGE_THIS_ROUTER_SECRET
ENTERPRISE_NODE_SECRET=CHANGE_THIS_ENTERPRISE_SECRET

# Stripe
STRIPE_SECRET_KEY=sk_live_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME

# App URLs (update with your domain)
NEXT_PUBLIC_APP_URL=https://streetmp.com
NEXT_PUBLIC_AUTH_SERVICE_URL=https://api.streetmp.com/api/v1/auth
NEXT_PUBLIC_ENFORCER_SERVICE_URL=https://api.streetmp.com/api/v1
NEXT_PUBLIC_TRUST_SERVICE_URL=https://trust.streetmp.com/api/v1/trust
NEXT_PUBLIC_USAGE_SERVICE_URL=https://api.streetmp.com/api/v1/usage
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_REPLACE_ME

# OpenAI (if used)
OPENAI_API_KEY=sk-REPLACE_ME

# Grafana
GRAFANA_PASSWORD=CHANGE_THIS_GRAFANA_PASSWORD
ENVTEMPLATE

  echo -e "${YELLOW}  ⚠  .env.prod template created. EDIT IT NOW before proceeding:${RESET}"
  echo -e "${YELLOW}     nano $DEPLOY_DIR/.env.prod${RESET}"
  echo ""
  read -rp "$(echo -e "${BLUE}Have you filled in .env.prod? [y/N]: ${RESET}")" CONFIRMED
  if [[ ! "$CONFIRMED" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Exiting. Re-run this script after filling in .env.prod${RESET}"
    exit 0
  fi
else
  echo -e "${GREEN}  ✓ .env.prod found${RESET}"
fi

echo ""

# ── Step 4: Build and launch ───────────────────────────────
echo -e "${BOLD}[4/6] Building Docker images and launching services...${RESET}"
echo -e "${YELLOW}  This may take 5-10 minutes on first build...${RESET}"
echo ""

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build --remove-orphans

echo ""

# ── Step 5: Health checks ──────────────────────────────────
echo -e "${BOLD}[5/6] Waiting for services to become healthy...${RESET}"

sleep 15

SERVICES=(
  "http://localhost:3000|web-frontend"
)

for entry in "${SERVICES[@]}"; do
  IFS="|" read -r url label <<< "$entry"
  echo -n "  Checking $label..."
  for i in {1..12}; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo -e " ${GREEN}✓ HEALTHY${RESET}"
      break
    fi
    sleep 5
    echo -n "."
    if [[ $i -eq 12 ]]; then
      echo -e " ${YELLOW}⚠ Still starting — check: docker compose -f docker-compose.prod.yml logs${RESET}"
    fi
  done
done

echo ""

# ── Step 6: Summary ────────────────────────────────────────
echo -e "${BOLD}[6/6] Deployment summary:${RESET}"
docker compose -f docker-compose.prod.yml ps

echo ""
echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  🚀  StreetMP OS V52 is LIVE on this VPS                 ║${RESET}"
echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Dashboard:${RESET}   http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP'):3000"
echo -e "  ${BOLD}Logs:${RESET}        docker compose -f $DEPLOY_DIR/docker-compose.prod.yml logs -f"
echo -e "  ${BOLD}Status:${RESET}      docker compose -f $DEPLOY_DIR/docker-compose.prod.yml ps"
echo ""
echo -e "${YELLOW}  ⚠ SECURITY REMINDER: Change your root SSH password now!${RESET}"
echo -e "${YELLOW}     passwd${RESET}"
echo ""
