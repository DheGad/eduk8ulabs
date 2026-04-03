#!/usr/bin/env bash
# ============================================================
# deploy.sh — Streetmp OS Enterprise One-Click Installer
# ============================================================
#
# USAGE
#   ./deploy.sh
#   ./deploy.sh --dry-run    (validate only, don't start services)
#   ./deploy.sh --down       (stop and remove containers + volumes)
#
# REQUIREMENTS
#   • docker >= 20.10
#   • docker compose v2 (docker compose) OR docker-compose v1
#   • .env.example in the same directory as this script
#
# ============================================================
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/.env.example"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.enterprise.yml"

# ── Banner ─────────────────────────────────────────────────────
echo -e "${BLUE}${BOLD}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         StreetMP OS — Enterprise Deployment              ║"
echo "║         Zero-Payload Telemetry Billing Shield            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Parse arguments ────────────────────────────────────────────
DRY_RUN=false
TEAR_DOWN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --down)    TEAR_DOWN=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run|--down|--help]"
      echo ""
      echo "  --dry-run   Validate environment and config without starting services"
      echo "  --down      Stop and remove all containers and volumes"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown argument: $arg${RESET}"
      exit 1
      ;;
  esac
done

# ============================================================
# TASK 1: VALIDATE DEPENDENCIES
# ============================================================

echo -e "${BOLD}[1/5] Validating dependencies...${RESET}"

check_command() {
  local cmd="$1"
  local install_hint="$2"
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}✗ '$cmd' not found. ${install_hint}${RESET}"
    return 1
  fi
  local version
  version="$("$cmd" --version 2>&1 | head -n1)"
  echo -e "${GREEN}✓ $cmd${RESET} — $version"
  return 0
}

DEPS_OK=true

check_command "docker" "Install from https://docs.docker.com/get-docker/" || DEPS_OK=false

# Detect compose command: prefer 'docker compose' (v2), fall back to 'docker-compose' (v1)
COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
  echo -e "${GREEN}✓ docker compose${RESET} — $(docker compose version 2>&1 | head -n1)"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
  echo -e "${GREEN}✓ docker-compose${RESET} — $(docker-compose --version 2>&1 | head -n1)"
else
  echo -e "${RED}✗ docker compose / docker-compose not found.${RESET}"
  echo "  Install Docker Desktop or 'sudo apt-get install docker-compose-plugin'"
  DEPS_OK=false
fi

if [[ "$DEPS_OK" == "false" ]]; then
  echo -e "${RED}${BOLD}Dependency check failed. Fix the above issues and re-run.${RESET}"
  exit 1
fi

echo ""

# ── Tear-down mode ─────────────────────────────────────────────
if [[ "$TEAR_DOWN" == "true" ]]; then
  echo -e "${YELLOW}${BOLD}[TEARDOWN] Stopping all Streetmp OS containers and volumes...${RESET}"
  $COMPOSE_CMD -f "$COMPOSE_FILE" down -v --remove-orphans
  echo -e "${GREEN}✓ Teardown complete.${RESET}"
  exit 0
fi

# ============================================================
# TASK 2: ENVIRONMENT SETUP
# ============================================================

echo -e "${BOLD}[2/5] Setting up environment...${RESET}"

# Create .env from .env.example if missing
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$ENV_EXAMPLE" ]]; then
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo -e "${YELLOW}⚠  .env not found — copied from .env.example${RESET}"
    echo -e "${YELLOW}   You must fill in required secrets before continuing.${RESET}"
  else
    echo -e "${RED}✗ Neither .env nor .env.example found at: ${SCRIPT_DIR}${RESET}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ .env file found${RESET}"
fi

# ── Prompt for ENTERPRISE_NODE_SECRET ──────────────────────────
# Check if already set in .env
CURRENT_SECRET
CURRENT_SECRET=$(grep -E '^ENTERPRISE_NODE_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")

if [[ -z "$CURRENT_SECRET" || "$CURRENT_SECRET" == "REPLACE_WITH_RANDOM_64_HEX_SECRET" ]]; then
  echo ""
  echo -e "${YELLOW}${BOLD}ENTERPRISE_NODE_SECRET is not set.${RESET}"
  echo "This is the HMAC signing key for Zero-Payload Telemetry."
  echo "It authenticates your node's billing pulses to HQ."
  echo ""

  # Offer to auto-generate
  if command -v openssl &>/dev/null; then
    read -rp "$(echo -e "${BLUE}Auto-generate a secure random secret? [Y/n]: ${RESET}")" AUTO_GEN
    AUTO_GEN="${AUTO_GEN:-Y}"
    if [[ "$AUTO_GEN" =~ ^[Yy]$ ]]; then
      GENERATED_SECRET=$(openssl rand -hex 32)
      # Update .env (replace placeholder or empty value)
      if grep -q '^ENTERPRISE_NODE_SECRET=' "$ENV_FILE"; then
        sed -i.bak "s|^ENTERPRISE_NODE_SECRET=.*|ENTERPRISE_NODE_SECRET=${GENERATED_SECRET}|" "$ENV_FILE"
      else
        echo "ENTERPRISE_NODE_SECRET=${GENERATED_SECRET}" >> "$ENV_FILE"
      fi
      echo -e "${GREEN}✓ Generated and saved ENTERPRISE_NODE_SECRET${RESET}"
      echo -e "${YELLOW}  IMPORTANT: Copy this secret to your enterprise_nodes table:${RESET}"
      echo -e "${BOLD}  ${GENERATED_SECRET}${RESET}"
      echo ""
    else
      read -rsp "$(echo -e "${BLUE}Enter your ENTERPRISE_NODE_SECRET (hidden): ${RESET}")" USER_SECRET
      echo ""
      if [[ -z "$USER_SECRET" ]]; then
        echo -e "${RED}✗ ENTERPRISE_NODE_SECRET cannot be empty.${RESET}"
        exit 1
      fi
      if grep -q '^ENTERPRISE_NODE_SECRET=' "$ENV_FILE"; then
        sed -i.bak "s|^ENTERPRISE_NODE_SECRET=.*|ENTERPRISE_NODE_SECRET=${USER_SECRET}|" "$ENV_FILE"
      else
        echo "ENTERPRISE_NODE_SECRET=${USER_SECRET}" >> "$ENV_FILE"
      fi
      echo -e "${GREEN}✓ ENTERPRISE_NODE_SECRET saved${RESET}"
    fi
  else
    # openssl not available — prompt only
    read -rsp "$(echo -e "${BLUE}Enter your ENTERPRISE_NODE_SECRET (hidden): ${RESET}")" USER_SECRET
    echo ""
    if [[ -z "$USER_SECRET" ]]; then
      echo -e "${RED}✗ ENTERPRISE_NODE_SECRET cannot be empty.${RESET}"
      exit 1
    fi
    if grep -q '^ENTERPRISE_NODE_SECRET=' "$ENV_FILE"; then
      sed -i.bak "s|^ENTERPRISE_NODE_SECRET=.*|ENTERPRISE_NODE_SECRET=${USER_SECRET}|" "$ENV_FILE"
    else
      echo "ENTERPRISE_NODE_SECRET=${USER_SECRET}" >> "$ENV_FILE"
    fi
    echo -e "${GREEN}✓ ENTERPRISE_NODE_SECRET saved${RESET}"
  fi
else
  echo -e "${GREEN}✓ ENTERPRISE_NODE_SECRET is set${RESET}"
fi

echo ""

# ============================================================
# VALIDATE REQUIRED SECRETS
# ============================================================

echo -e "${BOLD}[3/5] Validating required secrets...${RESET}"

REQUIRED_VARS=(
  "POSTGRES_PASSWORD"
  "JWT_SECRET"
  "VAULT_MASTER_KEY"
  "INTERNAL_ROUTER_SECRET"
  "ENTERPRISE_NODE_SECRET"
)

SECRETS_OK=true
# shellcheck source=/dev/null
source "$ENV_FILE" 2>/dev/null || true

for var in "${REQUIRED_VARS[@]}"; do
  val="${!var:-}"
  if [[ -z "$val" ]]; then
    echo -e "${RED}  ✗ $var is not set in .env${RESET}"
    SECRETS_OK=false
  else
    # Show first 4 chars + asterisks (never log full secret)
    masked="${val:0:4}$(printf '*%.0s' {1..12})"
    echo -e "${GREEN}  ✓ $var${RESET} = $masked"
  fi
done

if [[ "$SECRETS_OK" == "false" ]]; then
  echo ""
  echo -e "${RED}${BOLD}Required secrets missing. Edit .env and re-run.${RESET}"
  exit 1
fi

echo ""

# ============================================================
# DRY RUN EXIT
# ============================================================

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${YELLOW}${BOLD}[DRY RUN] Validation complete. No services were started.${RESET}"
  echo "Run without --dry-run to deploy."
  exit 0
fi

# ============================================================
# TASK 3: BUILD & LAUNCH
# ============================================================

echo -e "${BOLD}[4/5] Building images and launching services...${RESET}"
echo -e "${YELLOW}This may take several minutes on first build (Docker layer cache will speed up subsequent runs).${RESET}"
echo ""

$COMPOSE_CMD -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo ""

# ============================================================
# HEALTH CHECK
# ============================================================

echo -e "${BOLD}[5/5] Waiting for services to become healthy...${RESET}"

MAX_WAIT=120
ELAPSED=0
INTERVAL=5

HEALTH_ENDPOINTS=(
  "http://localhost:4003/health|enforcer-service"
  "http://localhost:3000|web-app"
)

for endpoint_label in "${HEALTH_ENDPOINTS[@]}"; do
  IFS="|" read -r endpoint label <<< "$endpoint_label"
  echo -n "  Waiting for $label ($endpoint)..."

  ELAPSED=0
  until curl -sf "$endpoint" &>/dev/null; do
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
    echo -n "."
    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
      echo -e " ${RED}TIMEOUT${RESET}"
      echo -e "${YELLOW}  Service may still be starting. Check logs: $COMPOSE_CMD -f $COMPOSE_FILE logs $label${RESET}"
      break
    fi
  done

  if curl -sf "$endpoint" &>/dev/null; then
    echo -e " ${GREEN}✓ HEALTHY${RESET}"
  fi
done

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║  ✅  Streetmp OS Enterprise Stack is LIVE                ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Enforcer API:${RESET}   http://localhost:4003/api/v1/enforce"
echo -e "  ${BOLD}Dashboard:${RESET}      http://localhost:3000"
echo -e ""
echo -e "  ${BOLD}Logs:${RESET}           $COMPOSE_CMD -f docker-compose.enterprise.yml logs -f"
echo -e "  ${BOLD}Status:${RESET}         $COMPOSE_CMD -f docker-compose.enterprise.yml ps"
echo -e "  ${BOLD}Stop:${RESET}           ./deploy.sh --down"
echo ""
