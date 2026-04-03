#!/usr/bin/env bash
# =============================================================
# scripts/smoke-test.sh
# End-to-End Production Smoke Test — Streetmp OS
# =============================================================
# Validates the 4-service handshake:
#   Caddy → Enforcer → Router → Usage → Trust
#
# Usage:
#   # Against local stack:
#   bash scripts/smoke-test.sh
#
#   # Against production:
#   ENFORCER_URL=https://api.streetmp.com \
#   TRUST_URL=https://trust.streetmp.com \
#   USAGE_URL=http://usage-service:4004 \
#   bash scripts/smoke-test.sh
#
# Requirements: curl, jq
# =============================================================

set -euo pipefail

ENFORCER_URL="${ENFORCER_URL:-http://localhost:4001}"
TRUST_URL="${TRUST_URL:-http://localhost:4005}"
USAGE_URL="${USAGE_URL:-http://localhost:4004}"

# Auth token for authenticated endpoints
TEST_JWT="${SMOKE_TEST_JWT:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
CHECK_NUM=0

pass()  { echo -e "  ${GREEN}✓ PASS${NC}  $1"; ((PASS++)); }
fail()  { echo -e "  ${RED}✗ FAIL${NC}  $1"; ((FAIL++)); }
info()  { echo -e "  ${CYAN}→${NC}       $1"; }
step()  { ((CHECK_NUM++)); echo -e "\n${BOLD}[CHECK ${CHECK_NUM}]${NC} $1"; }
banner(){ echo -e "\n${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

banner
echo -e "${BOLD}  Streetmp OS — End-to-End Smoke Test${NC}"
echo -e "  $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
banner

# ─────────────────────────────────────────────────────────────
# CHECK 1: Enforcer Health
# ─────────────────────────────────────────────────────────────
step "Enforcer Service Health ($ENFORCER_URL)"
HTTP=$(curl -sf -o /tmp/stest_enforcer_health.json -w "%{http_code}" \
  "${ENFORCER_URL}/health" 2>/dev/null || echo "000")

if [[ "$HTTP" == "200" ]]; then
  STATUS=$(jq -r '.status' /tmp/stest_enforcer_health.json 2>/dev/null || echo "unknown")
  pass "HTTP 200 | status: $STATUS"
else
  fail "HTTP $HTTP (expected 200) — Enforcer is down"
fi

# ─────────────────────────────────────────────────────────────
# CHECK 2: Trust Service Health
# ─────────────────────────────────────────────────────────────
step "Trust Service Health ($TRUST_URL)"
HTTP=$(curl -sf -o /tmp/stest_trust_health.json -w "%{http_code}" \
  "${TRUST_URL}/health" 2>/dev/null || echo "000")

if [[ "$HTTP" == "200" ]]; then
  pass "HTTP 200 | Trust Service online"
else
  fail "HTTP $HTTP — Trust Service is down"
fi

# ─────────────────────────────────────────────────────────────
# CHECK 3: Public Marketplace endpoint (no auth required)
# ─────────────────────────────────────────────────────────────
step "Public Marketplace Discovery API"
HTTP=$(curl -sf -o /tmp/stest_marketplace.json -w "%{http_code}" \
  "${TRUST_URL}/api/v1/trust/marketplace?limit=1" 2>/dev/null || echo "000")

if [[ "$HTTP" == "200" ]]; then
  COUNT=$(jq -r '.count // 0' /tmp/stest_marketplace.json 2>/dev/null || echo "?")
  pass "HTTP 200 | $COUNT engineers returned"
else
  fail "HTTP $HTTP — Marketplace endpoint not reachable"
fi

# ─────────────────────────────────────────────────────────────
# CHECK 4: JWT-authenticated Enforcer execution
# ─────────────────────────────────────────────────────────────
step "Enforcer Execution — Full 4-Service Handshake"

if [[ -z "$TEST_JWT" ]]; then
  echo -e "  ${YELLOW}⚠ SKIP${NC}  SMOKE_TEST_JWT not set — skipping authenticated execution test."
  echo "          Set SMOKE_TEST_JWT=\$(your test token) to enable this check."
else
  PAYLOAD=$(cat <<'EOF'
{
  "prompt": "Smoke test: Return a JSON object with keys: verdict and confidence_score.",
  "required_keys": ["verdict", "confidence_score"],
  "model": "gpt-4o",
  "max_attempts": 1
}
EOF
)

  START_MS=$(($(date +%s%N) / 1000000))
  HTTP=$(curl -sf -o /tmp/stest_execution.json \
    -w "%{http_code}" \
    -X POST "${ENFORCER_URL}/api/v1/enforce" \
    -H "Authorization: Bearer ${TEST_JWT}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null || echo "000")
  END_MS=$(($(date +%s%N) / 1000000))
  LATENCY=$((END_MS - START_MS))

  if [[ "$HTTP" == "200" ]]; then
    SUCCESS=$(jq -r '.success' /tmp/stest_execution.json 2>/dev/null || echo "false")
    USAGE_LOG_ID=$(jq -r '.usage_log_id // "none"' /tmp/stest_execution.json 2>/dev/null)
    ATTEMPTS=$(jq -r '.attempts // 1' /tmp/stest_execution.json 2>/dev/null)

    if [[ "$SUCCESS" == "true" ]]; then
      pass "Enforcer returned success in ${LATENCY}ms | usage_log_id=${USAGE_LOG_ID} | attempts=${ATTEMPTS}"
      info "→ Router called LLM and returned structured JSON"
      info "→ Usage Service logged ${USAGE_LOG_ID}"

      # Verify Trust Service received the trace
      sleep 1  # Brief delay for async trace logging
      TRACE_HTTP=$(curl -sf -w "%{http_code}" -o /tmp/stest_hcq.json \
        "${TRUST_URL}/api/v1/trust/hcq/$(jq -r '.user_id // ""' /tmp/stest_execution.json 2>/dev/null)" \
        2>/dev/null || echo "000")
      if [[ "$TRACE_HTTP" == "200" ]]; then
        HCQ=$(jq -r '.data.global_hcq_score // "N/A"' /tmp/stest_hcq.json 2>/dev/null)
        info "→ Trust Service HCQ profile updated | score=${HCQ}"
      fi
    else
      fail "Execution returned success=false — check Enforcer logs"
    fi
  else
    fail "HTTP $HTTP — Execution failed"
    [[ -f /tmp/stest_execution.json ]] && jq . /tmp/stest_execution.json 2>/dev/null || true
  fi
fi

# ─────────────────────────────────────────────────────────────
# CHECK 5: Semantic Cache (cache header detection)
# ─────────────────────────────────────────────────────────────
step "Semantic Cache (X-Cache-Hit header)"
if [[ -n "$TEST_JWT" ]]; then
  CACHE_PAYLOAD='{"prompt":"What is 2+2?","required_keys":["answer"],"model":"gpt-4o"}'

  # First call — should MISS
  HEADERS_1=$(curl -si -o /dev/null \
    -X POST "${ENFORCER_URL}/api/v1/enforce" \
    -H "Authorization: Bearer ${TEST_JWT}" \
    -H "Content-Type: application/json" \
    -d "$CACHE_PAYLOAD" 2>/dev/null | grep -i "x-cache" || echo "x-cache-hit: miss")

  # Second call — should HIT
  sleep 0.3
  HEADERS_2=$(curl -si -o /dev/null \
    -X POST "${ENFORCER_URL}/api/v1/enforce" \
    -H "Authorization: Bearer ${TEST_JWT}" \
    -H "Content-Type: application/json" \
    -d "$CACHE_PAYLOAD" 2>/dev/null | grep -i "x-cache" || echo "x-cache-hit: miss")

  info "Call 1: $HEADERS_1"
  info "Call 2: $HEADERS_2"

  if echo "$HEADERS_2" | grep -qi "hit: true"; then
    pass "Cache HIT on second identical prompt"
  else
    echo -e "  ${YELLOW}⚠ WARN${NC}  Cache miss on second call — check Redis/cache TTL config"
  fi
else
  echo -e "  ${YELLOW}⚠ SKIP${NC}  SMOKE_TEST_JWT not set"
fi

# ─────────────────────────────────────────────────────────────
# FINAL REPORT
# ─────────────────────────────────────────────────────────────
banner
TOTAL=$((PASS + FAIL))
if [[ $FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✓ ALL $PASS/$TOTAL CHECKS PASSED — Stack is production-ready${NC}"
else
  echo -e "${RED}${BOLD}  ✗ $FAIL/$TOTAL CHECKS FAILED — DO NOT deploy to production${NC}"
  echo "  Review failures above and check service logs:"
  echo "  docker compose -f docker-compose.prod.yml logs -f [service-name]"
fi
banner
echo ""

exit $([[ $FAIL -eq 0 ]] && echo 0 || echo 1)
