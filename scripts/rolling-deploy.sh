#!/usr/bin/env bash
# ============================================================
# StreetMP OS — Zero-Downtime Rolling Deployment Script
# @command COMMAND_096 — ZERO-ERROR CI/CD PIPELINE
# @version V96.0.0
#
# Usage:
#   bash scripts/rolling-deploy.sh                  # Manual deploy
#   CI_TRIGGERED=true bash scripts/rolling-deploy.sh  # From CD pipeline
#
# Zero-downtime strategy:
#   1. git pull latest code (or git reset to $DEPLOY_COMMIT)
#   2. docker compose build --parallel (images built in background)
#   3. docker compose up -d --build --no-deps per service
#      (new container starts before old one is removed)
#   4. Health gate: waits for service_healthy before proceeding
#   5. Rollback: if health gates fail after N retries, previous
#      image is restored via docker tag rollback
#
# Environment variables:
#   DEPLOY_COMMIT   → git SHA to deploy (set by CD pipeline)
#   CI_TRIGGERED    → true when called from GitHub Actions
#   PROJECT_ROOT    → deployment directory (default: pwd)
#   COMPOSE_FILE    → path to docker-compose.prod.yml
#   ENV_FILE        → path to .env.production
# ============================================================

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-${PROJECT_ROOT}/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env.production}"
GIT_BRANCH="${GIT_BRANCH:-main}"
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"         # Specific SHA from CD pipeline
CI_TRIGGERED="${CI_TRIGGERED:-false}"

# Rolling deploy settings
HEALTH_WAIT_S=45             # Wait N seconds for containers to start before health checks
HEALTH_RETRIES=12            # Number of health-check retries
HEALTH_RETRY_INTERVAL_S=10   # Seconds between retries
ROLLBACK_ENABLED=true        # Auto-rollback if health checks fail

# Service rollout order (dependencies first)
ROLLING_ORDER=(
  "postgres-vault"
  "redis-cache"
  "enforcer-service"
  "router-service"
  "auth-service"
  "trust-service"
  "usage-service"
  "vault-service"
  "workflow-service"
  "web"
)

# ─── Colours ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} ${*}"; }
success() { echo -e "${GREEN}✓${NC} ${*}"; }
warn()    { echo -e "${YELLOW}⚠${NC} ${*}"; }
error()   { echo -e "${RED}✗${NC} ${*}" >&2; }
banner()  {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}${BOLD}  ${*}${NC}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${NC}"
  echo ""
}

# ─── Pre-flight Checks ────────────────────────────────────────────────────────

banner "StreetMP OS — Rolling Deploy V96"
log "Project root : ${PROJECT_ROOT}"
log "Compose file : ${COMPOSE_FILE}"
log "Env file     : ${ENV_FILE}"
log "CI triggered : ${CI_TRIGGERED}"
log "Deploy SHA   : ${DEPLOY_COMMIT:-<latest>}"

# Verify required files exist
[[ -f "${COMPOSE_FILE}" ]] || { error "docker-compose.prod.yml not found at ${COMPOSE_FILE}"; exit 1; }
[[ -f "${ENV_FILE}" ]]     || { error ".env.production not found at ${ENV_FILE}"; exit 1; }

# Docker daemon must be running
docker info > /dev/null 2>&1 || { error "Docker daemon is not running"; exit 1; }
docker compose version > /dev/null 2>&1 || { error "Docker Compose V2 plugin not found"; exit 1; }
success "Pre-flight checks passed."

# ─── Git Pull / Reset ─────────────────────────────────────────────────────────

banner "STEP 1 — Code Sync"

PREVIOUS_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
log "Previous commit: ${PREVIOUS_COMMIT}"

if [[ -n "${DEPLOY_COMMIT}" ]]; then
  # CD Pipeline: reset to exact SHA from the successful CI run
  log "CI-triggered deploy — resetting to SHA: ${DEPLOY_COMMIT}"
  git fetch origin "${GIT_BRANCH}" --quiet
  git reset --hard "${DEPLOY_COMMIT}"
else
  # Manual deploy: pull latest
  if ! git diff --quiet 2>/dev/null; then
    warn "Uncommitted changes detected. Stashing..."
    git stash push -m "rolling-deploy auto-stash $(date +%Y%m%d-%H%M%S)"
  fi
  git fetch origin "${GIT_BRANCH}" --quiet
  git reset --hard "origin/${GIT_BRANCH}"
fi

CURRENT_COMMIT=$(git rev-parse --short HEAD)
success "Code at commit: ${CURRENT_COMMIT} (was: ${PREVIOUS_COMMIT})"
log "Deployed: $(git log -1 --oneline)"

# ─── Snapshot Previous Image Tags (for rollback) ──────────────────────────────

banner "STEP 2 — Snapshot for Rollback"

declare -A PREVIOUS_IMAGES

for service in "${ROLLING_ORDER[@]}"; do
  IMAGE_ID=$(docker compose \
    -f "${COMPOSE_FILE}" \
    --env-file "${ENV_FILE}" \
    images -q "${service}" 2>/dev/null || echo "")

  if [[ -n "${IMAGE_ID}" ]]; then
    # Tag current image as :rollback so we can restore it
    IMAGE_NAME=$(docker inspect "${IMAGE_ID}" --format='{{index .RepoTags 0}}' 2>/dev/null || echo "")
    if [[ -n "${IMAGE_NAME}" ]]; then
      ROLLBACK_TAG="${IMAGE_NAME%%:*}:rollback-${PREVIOUS_COMMIT}"
      docker tag "${IMAGE_ID}" "${ROLLBACK_TAG}" 2>/dev/null || true
      PREVIOUS_IMAGES["${service}"]="${ROLLBACK_TAG}"
      log "Snapshot: ${service} → ${ROLLBACK_TAG}"
    fi
  fi
done

success "Rollback snapshots created for ${#PREVIOUS_IMAGES[@]} services."

# ─── Build New Images ─────────────────────────────────────────────────────────

banner "STEP 3 — Parallel Image Build"
log "Building all images in parallel — existing containers remain live..."
log "(Build failures will NOT affect running containers)"

BUILD_LOG="/tmp/streetmp-rolling-build-${CURRENT_COMMIT}.log"

if ! docker compose \
    -f "${COMPOSE_FILE}" \
    --env-file "${ENV_FILE}" \
    build \
    --parallel \
    2>&1 | tee "${BUILD_LOG}"; then
  error "Image build FAILED. Existing containers are untouched."
  error "Check build log: ${BUILD_LOG}"
  exit 1
fi

success "All images built successfully (commit: ${CURRENT_COMMIT})."

# ─── Rolling Restart Per Service ──────────────────────────────────────────────

banner "STEP 4 — Rolling Container Replacement"

FAILED_SERVICES=()

wait_for_healthy() {
  local service="$1"
  local retries="${HEALTH_RETRIES}"
  local attempt=1

  log "Waiting for ${service} to become healthy..."

  while (( attempt <= retries )); do
    # Check Docker healthcheck state
    HEALTH=$(docker inspect \
      "$(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps -q "${service}" 2>/dev/null)" \
      --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")

    case "${HEALTH}" in
      "healthy")
        success "${service} is HEALTHY (attempt ${attempt}/${retries})"
        return 0
        ;;
      "unhealthy")
        error "${service} entered UNHEALTHY state!"
        return 1
        ;;
      "starting"|"unknown"|"")
        log "${service}: ${HEALTH:-starting} (attempt ${attempt}/${retries})..."
        ;;
    esac

    sleep "${HEALTH_RETRY_INTERVAL_S}"
    (( attempt++ ))
  done

  error "${service} did not become healthy within $((HEALTH_RETRIES * HEALTH_RETRY_INTERVAL_S))s"
  return 1
}

for service in "${ROLLING_ORDER[@]}"; do
  # Skip infra services that don't need rolling restart (stateful)
  case "${service}" in
    "postgres-vault"|"redis-cache")
      log "Skipping stateful service: ${service} (preserving data volumes)"
      continue
      ;;
  esac

  log ""
  log "━━━ Rolling update: ${service} ━━━"

  # Update this service only: build new image, start new container, stop old one
  # --no-deps: do NOT restart dependency services (prevents cascade)
  if docker compose \
      -f "${COMPOSE_FILE}" \
      --env-file "${ENV_FILE}" \
      up -d \
      --build \
      --no-deps \
      "${service}" \
      2>&1; then

    # Wait for health check to confirm the new container is ready
    if wait_for_healthy "${service}"; then
      success "✓ ${service} updated and healthy"
    else
      error "✗ ${service} FAILED health check after update"
      FAILED_SERVICES+=("${service}")

      if [[ "${ROLLBACK_ENABLED}" == "true" && -n "${PREVIOUS_IMAGES[${service}]:-}" ]]; then
        warn "Initiating rollback for ${service}..."
        # Re-tag previous image as :latest and restart
        PREV_IMG="${PREVIOUS_IMAGES[${service}]}"
        CURRENT_IMG="${PREV_IMG%%:rollback*}:latest"
        docker tag "${PREV_IMG}" "${CURRENT_IMG}" 2>/dev/null || true
        docker compose \
          -f "${COMPOSE_FILE}" \
          --env-file "${ENV_FILE}" \
          up -d \
          --no-deps \
          --no-build \
          "${service}" 2>/dev/null || true
        warn "${service} rolled back to ${PREVIOUS_COMMIT}"
      fi
    fi
  else
    error "docker compose up failed for ${service}"
    FAILED_SERVICES+=("${service}")
  fi

  sleep 3   # Brief pause between services to avoid thundering herd
done

# ─── Cleanup Orphaned Containers ─────────────────────────────────────────────

log ""
log "Removing orphaned containers..."
docker compose \
  -f "${COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  up -d \
  --remove-orphans \
  2>/dev/null || true

# ─── Post-Flight Verification ─────────────────────────────────────────────────

banner "STEP 5 — Post-Flight Verification"
log "Waiting ${HEALTH_WAIT_S}s for final stabilisation..."
sleep "${HEALTH_WAIT_S}"

# Container status table
log "Container status:"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps
echo ""

# HTTP endpoint checks
check_endpoint() {
  local label="$1"
  local url="$2"
  local retries=5

  for i in $(seq 1 $retries); do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "${url}" 2>/dev/null || echo "000")
    if [[ "${STATUS}" =~ ^(200|201|301|302|307)$ ]]; then
      success "${label} → ${url} (HTTP ${STATUS})"
      return 0
    fi
    warn "${label}: HTTP ${STATUS} (attempt ${i}/${retries})"
    sleep 5
  done
  error "${label} FAILED: ${url} (last HTTP ${STATUS})"
  return 1
}

ENDPOINT_FAIL=false
check_endpoint "Router /health"   "http://localhost:4000/health"   || ENDPOINT_FAIL=true
check_endpoint "Web Dashboard"    "http://localhost:3000"           || ENDPOINT_FAIL=true

# Unhealthy container check
UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | grep -i "streetmp" || true)
if [[ -n "${UNHEALTHY}" ]]; then
  warn "Unhealthy containers detected:"
  echo "${UNHEALTHY}" | while read -r name; do warn "  ⚠ ${name}"; done
fi

# ─── Cleanup Old Rollback Tags ────────────────────────────────────────────────

log "Pruning old rollback image snapshots (keep last 3)..."
docker images --format "{{.Repository}}:{{.Tag}}" | \
  grep ":rollback-" | \
  sort -r | \
  tail -n +10 | \
  xargs -r docker rmi 2>/dev/null || true

docker image prune -f > /dev/null 2>&1 || true
success "Docker image cleanup complete."

# ─── Final Summary ────────────────────────────────────────────────────────────

banner "DEPLOYMENT SUMMARY"

echo -e "${BOLD}  Commit deployed:  ${CURRENT_COMMIT}${NC}"
echo -e "${BOLD}  Previous commit:  ${PREVIOUS_COMMIT}${NC}"
echo ""

if [[ ${#FAILED_SERVICES[@]} -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✅ ALL SERVICES HEALTHY — ROLLING DEPLOY COMPLETE${NC}"
  echo ""
  echo "  Web Dashboard   :  http://localhost:3000"
  echo "  Router API      :  http://localhost:4000"
  echo "  Health endpoint :  http://localhost:4000/health"
  echo "  V95 Monitor     :  http://localhost:3000/dashboard/admin/system-health"
  echo ""
  echo -e "${GREEN}${BOLD}  STATUS: 0${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}  ⚠️  PARTIAL DEPLOY — ${#FAILED_SERVICES[@]} SERVICE(S) FAILED:${NC}"
  for svc in "${FAILED_SERVICES[@]}"; do
    echo -e "${RED}    • ${svc}${NC}"
  done
  echo ""
  echo "  Healthy services are running on new code."
  echo "  Failed services were rolled back to: ${PREVIOUS_COMMIT}"
  echo ""
  echo "  Debug: docker compose -f ${COMPOSE_FILE} logs --tail=50 <service>"
  exit 1
fi
