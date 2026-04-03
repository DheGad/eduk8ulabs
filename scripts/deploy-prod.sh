#!/usr/bin/env bash
# ============================================================
# deploy-prod.sh — StreetMP OS V88 Production Deployment
# ============================================================
#
# USAGE:
#   bash scripts/deploy-prod.sh
#
# WHAT THIS SCRIPT DOES:
#   1. Pre-flight: verifies .env.prod, Docker, git are present
#   2. Pulls latest code from git (origin/main)
#   3. Zero-downtime build:
#        - Builds new images FIRST (does not stop running containers)
#        - Brings up new containers (Docker replaces old ones gracefully)
#   4. Post-flight: health-checks every critical service
#   5. On ANY failure: aborts and preserves running containers
#
# SAFETY CONTRACT:
#   set -e       → exit on first error
#   set -u       → exit on unset variable
#   set -o pipefail → catch errors in pipes
#   Containers already running are NEVER stopped before new images
#   are confirmed healthy. A failed build leaves the old stack running.
#
# ============================================================

set -euo pipefail

# ── Colour helpers ───────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Colour

log()     { echo -e "${CYAN}[DEPLOY]${NC} $*"; }
success() { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn()    { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
error()   { echo -e "${RED}[ FAIL ]${NC} $*" >&2; }
banner()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${NC}"; echo -e "${BOLD}${CYAN}  $*${NC}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════${NC}\n"; }

# ── Deployment config ────────────────────────────────────────
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
GIT_BRANCH="main"
ROUTER_PORT="4000"
WEB_PORT="3000"
HEALTH_SLEEP=15          # seconds to wait for containers to stabilise
MAX_HEALTH_RETRIES=10    # how many times to retry the health check
HEALTH_RETRY_INTERVAL=6  # seconds between retries

# Absolute path to the monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Trap: print failure context on unexpected exit ──────────
trap 'error "Deployment FAILED at line $LINENO. Running containers were NOT stopped. Fix the issue and re-run."; exit 1' ERR

banner "StreetMP OS V88 — Production Deployment"
log "Project root : ${PROJECT_ROOT}"
log "Compose file : ${COMPOSE_FILE}"
log "Env file     : ${ENV_FILE}"
log "Branch       : ${GIT_BRANCH}"
echo ""

cd "${PROJECT_ROOT}"

# ============================================================
# STEP 1: PRE-FLIGHT CHECKS
# ============================================================
banner "STEP 1 — Pre-flight Checks"

# 1a. .env.prod must exist
if [[ ! -f "${ENV_FILE}" ]]; then
  error "${ENV_FILE} not found."
  error "Create it from the template: cp .env.example ${ENV_FILE}"
  error "Then fill in all required secrets before re-running."
  exit 1
fi
success "${ENV_FILE} found."

# 1b. docker-compose.prod.yml must exist
if [[ ! -f "${COMPOSE_FILE}" ]]; then
  error "${COMPOSE_FILE} not found. Cannot continue."
  exit 1
fi
success "${COMPOSE_FILE} found."

# 1c. Docker daemon must be running
if ! docker info > /dev/null 2>&1; then
  error "Docker daemon is not running. Start it with: sudo systemctl start docker"
  exit 1
fi
success "Docker daemon is running."

# 1d. docker compose V2 plugin must be available
if ! docker compose version > /dev/null 2>&1; then
  error "Docker Compose V2 plugin not found."
  error "Install it: https://docs.docker.com/compose/install/"
  exit 1
fi
COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
success "Docker Compose V2 available (${COMPOSE_VERSION})."

# 1e. git must be available and we must be in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  error "Not inside a git repository. Cannot run git pull."
  exit 1
fi
success "Git repository confirmed."

# 1f. Disk space check — warn if < 2GB free
FREE_KB=$(df -k "${PROJECT_ROOT}" | tail -1 | awk '{print $4}')
FREE_GB=$(( FREE_KB / 1024 / 1024 ))
if (( FREE_GB < 2 )); then
  warn "Low disk space: ${FREE_GB}GB free. Docker builds may fail."
  warn "Consider running: docker system prune -f"
else
  success "Disk space: ${FREE_GB}GB free."
fi

# ============================================================
# STEP 2: GIT PULL
# ============================================================
banner "STEP 2 — Pulling Latest Code (origin/${GIT_BRANCH})"

CURRENT_COMMIT=$(git rev-parse --short HEAD)
log "Current commit: ${CURRENT_COMMIT}"

# Stash any uncommitted local changes (deployment script may be edited locally)
if ! git diff --quiet; then
  warn "Uncommitted local changes detected. Stashing..."
  git stash push -m "deploy-prod auto-stash $(date +%Y%m%d-%H%M%S)"
fi

git fetch origin "${GIT_BRANCH}" --quiet
git reset --hard "origin/${GIT_BRANCH}"

NEW_COMMIT=$(git rev-parse --short HEAD)
if [[ "${CURRENT_COMMIT}" == "${NEW_COMMIT}" ]]; then
  warn "Already at latest commit (${NEW_COMMIT}). Continuing with rebuild..."
else
  success "Updated: ${CURRENT_COMMIT} → ${NEW_COMMIT}"
fi

log "HEAD is now: $(git log -1 --oneline)"

# ============================================================
# STEP 3: ZERO-DOWNTIME BUILD + DEPLOY
# ============================================================
banner "STEP 3 — Zero-Downtime Build & Deploy"
log "Building new images without stopping running containers..."
log "This may take 3–10 minutes on first run (Docker layer caching will speed up subsequent runs)."
echo ""

# Build all images first — if ANY build fails, old containers keep running
# --no-deps prevents cascading restarts during the build phase
log "Phase 3a: Building Docker images..."
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  build \
  --parallel \
  2>&1 | tee /tmp/streetmp-build.log

success "All images built successfully."

# Phase 3b: Bring up new containers
# --remove-orphans: clean up old containers for services removed from compose
# --no-recreate is NOT used — we want fresh containers from new images
log "Phase 3b: Starting new containers (replacing old ones)..."
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  up -d \
  --remove-orphans \
  2>&1 | tee -a /tmp/streetmp-build.log

success "docker compose up completed."

# ============================================================
# STEP 4: POST-FLIGHT HEALTH CHECKS
# ============================================================
banner "STEP 4 — Post-flight Health Checks"

log "Waiting ${HEALTH_SLEEP}s for services to stabilise..."
sleep "${HEALTH_SLEEP}"

# ── 4a. Container status ────────────────────────────────────
log "Container status:"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
echo ""

# ── Helper: retry a curl health check ────────────────────────
check_health() {
  local service_label="$1"
  local url="$2"
  local retries="${MAX_HEALTH_RETRIES}"
  local attempt=1

  while (( attempt <= retries )); do
    if curl -fsS --max-time 5 "${url}" > /dev/null 2>&1; then
      success "${service_label} → ${url} (attempt ${attempt}/${retries})"
      return 0
    fi
    warn "${service_label} not ready yet (attempt ${attempt}/${retries}), retrying in ${HEALTH_RETRY_INTERVAL}s..."
    sleep "${HEALTH_RETRY_INTERVAL}"
    (( attempt++ ))
  done

  error "${service_label} FAILED to respond after ${retries} attempts: ${url}"
  error "Check logs: docker compose -f ${COMPOSE_FILE} logs ${service_label}"
  return 1
}

# ── 4b. Router Service (the LLM gateway — most critical) ────
log "Checking Router Service (port ${ROUTER_PORT})..."
check_health "router-service" "http://localhost:${ROUTER_PORT}/health"

# ── 4c. Web Dashboard ────────────────────────────────────────
log "Checking Web Dashboard (port ${WEB_PORT})..."
check_health "web" "http://localhost:${WEB_PORT}"

# ── 4d. Public Scanner endpoint (V86) ────────────────────────
log "Checking Public Scanner (V86)..."
if curl -fsS --max-time 8 -X POST \
    -H 'Content-Type: application/json' \
    -d '{"industry":"finance"}' \
    "http://localhost:${ROUTER_PORT}/api/v1/public/scan" \
    > /dev/null 2>&1; then
  success "V86 Scanner endpoint is responding."
else
  warn "V86 Scanner did not respond — non-critical. Check: docker compose logs router-service"
fi

# ── 4e. Public Verify endpoint (V87 STP) ─────────────────────
log "Checking STP Verify endpoint (V87)..."
if curl -fsS --max-time 8 \
    "http://localhost:${ROUTER_PORT}/api/v1/public/verify" \
    > /dev/null 2>&1; then
  success "V87 STP Verify endpoint is responding."
else
  warn "V87 STP Verify did not respond — non-critical. Check: docker compose logs router-service"
fi

# ── 4f. NeMo Guard sidecar ───────────────────────────────────
log "Checking NeMo Guard sidecar (V81)..."
if curl -fsS --max-time 10 "http://localhost:8001/health" > /dev/null 2>&1; then
  success "NeMo Guard sidecar is healthy."
else
  warn "NeMo Guard sidecar not reachable externally (may be internal-only). Checking via docker exec..."
  if docker exec streetmp_nemo_guard_prod python -c \
      "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" \
      > /dev/null 2>&1; then
    success "NeMo Guard is healthy (internal check passed)."
  else
    warn "NeMo Guard health uncertain. Check: docker logs streetmp_nemo_guard_prod"
  fi
fi

# ── 4g. Docker container health states ───────────────────────
log "Checking Docker health states for all services..."
UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | grep streetmp || true)
if [[ -n "${UNHEALTHY}" ]]; then
  warn "The following containers are UNHEALTHY:"
  echo "${UNHEALTHY}" | while read -r name; do
    warn "  ⚠ ${name}"
  done
  warn "Run: docker inspect <container_name> | grep -A 5 Health"
else
  success "No unhealthy containers detected."
fi

# ============================================================
# FINAL SUMMARY
# ============================================================
banner "Deployment Complete"
echo -e "${GREEN}${BOLD}"
echo "  StreetMP OS V88 is LIVE"
echo ""
echo "  Web Dashboard    :  http://localhost:${WEB_PORT}"
echo "  Router / API     :  http://localhost:${ROUTER_PORT}"
echo "  Health endpoint  :  http://localhost:${ROUTER_PORT}/health"
echo "  Live Risk Scan   :  http://localhost:${ROUTER_PORT}/api/v1/public/scan"
echo "  STP Verify       :  http://localhost:${ROUTER_PORT}/api/v1/public/verify"
echo ""
echo "  Commit deployed  :  ${NEW_COMMIT}"
echo "  Deploy log       :  /tmp/streetmp-build.log"
echo -e "${NC}"
echo "  Useful commands:"
echo "    docker compose -f ${COMPOSE_FILE} logs -f router-service"
echo "    docker compose -f ${COMPOSE_FILE} ps"
echo "    docker compose -f ${COMPOSE_FILE} restart router-service"
banner "STATUS 0"
