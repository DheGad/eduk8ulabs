#!/usr/bin/env bash
# =============================================================================
# scripts/final-health-check.sh
# StreetMP OS — System Ignition Health Check Sweep
#
# Pings the /health endpoint of all services.
# On failure: prints docker logs for the failing container.
# =============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

TIMEOUT=5
PASS=0
FAIL=0
FAILED_CONTAINERS=()

echo ""
echo -e "${BOLD}${CYAN}============================================================${RESET}"
echo -e "${BOLD}${CYAN}  StreetMP OS — Final Health Check Sweep${RESET}"
echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo -e "${CYAN}============================================================${RESET}"
echo ""

# ── Check one service ─────────────────────────────────────────────
check() {
  local name="$1" port="$2" container="$3"
  printf "  %-26s  port %-5s  " "${name}" "${port}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${TIMEOUT}" \
    "http://localhost:${port}/health" 2>/dev/null || echo "000")
  if [[ "${code}" == "200" ]]; then
    echo -e "${GREEN}✓  200 OK${RESET}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗  ${code} FAIL${RESET}"
    FAIL=$((FAIL + 1))
    FAILED_CONTAINERS+=("${name}:${container}")
  fi
}

# ── Services (name port container) ───────────────────────────────
check "router-service"      4000 streetmp-router
check "enforcer-service"    4001 streetmp-enforcer
check "vault-service"       4002 streetmp-vault
check "usage-service"       4003 streetmp-usage
check "sanitizer-service"   4004 streetmp-sanitizer
check "trust-service"       4005 streetmp-trust
check "memory-service"      4007 streetmp-memory
check "policy-service"      4008 streetmp-policy
check "workflow-service"    4009 streetmp-workflow

# ── Frontend ──────────────────────────────────────────────────────
printf "  %-26s  port %-5s  " "web-app (Next.js)" "3000"
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "${TIMEOUT}" \
  "http://localhost:3000" 2>/dev/null || echo "000")
if [[ "${code}" == "200" ]]; then
  echo -e "${GREEN}✓  200 OK${RESET}"
  PASS=$((PASS + 1))
else
  echo -e "${YELLOW}~  ${code} (may still be starting)${RESET}"
fi

# ── Summary ───────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}------------------------------------------------------------${RESET}"
echo -e "  ${GREEN}${BOLD}Passed: ${PASS}${RESET}   ${RED}${BOLD}Failed: ${FAIL}${RESET}"
echo -e "${CYAN}------------------------------------------------------------${RESET}"

# ── Dump docker logs for failures ────────────────────────────────
if [[ "${#FAILED_CONTAINERS[@]}" -gt 0 ]]; then
  echo ""
  echo -e "${RED}${BOLD}Fetching docker logs for failed services...${RESET}"
  for entry in "${FAILED_CONTAINERS[@]}"; do
    local_svc="${entry%%:*}"
    local_cnt="${entry##*:}"
    echo ""
    echo -e "${YELLOW}══ ${local_svc} (${local_cnt}) ══${RESET}"
    if command -v docker &>/dev/null; then
      docker logs --tail 40 "${local_cnt}" 2>&1 \
        || echo "(container not found — may not have started)"
    else
      echo "(docker not available on this machine — check process list)"
      ps aux | grep "${local_cnt}" | grep -v grep || true
    fi
  done
  echo ""
  echo -e "${RED}${BOLD}System NOT fully operational. Fix errors above and re-run.${RESET}"
  echo ""
  exit 1
else
  echo ""
  echo -e "${GREEN}${BOLD}  ✓ ALL CHECKED SERVICES PASSED.${RESET}"
  echo ""
  exit 0
fi
