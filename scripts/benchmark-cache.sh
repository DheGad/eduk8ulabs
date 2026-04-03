#!/usr/bin/env bash
# =============================================================
# scripts/benchmark-cache.sh
# Semantic Cache Stress Test — Streetmp OS
# =============================================================
# Fires 10 identical prompts in parallel and measures:
#   • Cache hit rate (target ≥ 90%)
#   • Cached response latency (target < 200ms)
#   • First-call (cold) latency for comparison
#
# Usage:
#   SMOKE_TEST_JWT=<token> bash scripts/benchmark-cache.sh
# =============================================================

set -euo pipefail

ENFORCER_URL="${ENFORCER_URL:-http://localhost:4001}"
TEST_JWT="${SMOKE_TEST_JWT:-}"
CONCURRENCY="${CONCURRENCY:-10}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

if [[ -z "$TEST_JWT" ]]; then
  echo -e "${RED}FATAL: SMOKE_TEST_JWT is not set.${NC}"
  echo "  Usage: SMOKE_TEST_JWT=<jwt> bash $0"
  exit 1
fi

PROMPT_PAYLOAD=$(cat <<'EOF'
{
  "prompt": "List 3 programming languages with their primary use case. Return as JSON.",
  "required_keys": ["languages"],
  "model": "gpt-4o",
  "max_attempts": 1
}
EOF
)

TMPDIR_RESULTS=$(mktemp -d)
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Streetmp OS — Semantic Cache Benchmark${NC}"
echo -e "  Concurrency: $CONCURRENCY identical prompts"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── COLD: First call to populate the cache ────────────────────
echo -e "\n${BOLD}[COLD CALL]${NC} Populating cache..."
COLD_START=$(($(date +%s%N) / 1000000))
curl -sf -o "${TMPDIR_RESULTS}/cold.json" \
  -X POST "${ENFORCER_URL}/api/v1/enforce" \
  -H "Authorization: Bearer ${TEST_JWT}" \
  -H "Content-Type: application/json" \
  -d "$PROMPT_PAYLOAD" > /dev/null 2>&1 || true
COLD_END=$(($(date +%s%N) / 1000000))
COLD_LATENCY=$((COLD_END - COLD_START))
echo -e "  Cold call latency: ${BOLD}${COLD_LATENCY}ms${NC}"

sleep 0.2  # Let cache write settle

# ── HOT: Fire N concurrent requests ──────────────────────────
echo -e "\n${BOLD}[WARM CALLS]${NC} Firing $CONCURRENCY concurrent requests..."

PIDS=()
for i in $(seq 1 "$CONCURRENCY"); do
  (
    START=$(($(date +%s%N) / 1000000))
    HTTP=$(curl -sf \
      -o "${TMPDIR_RESULTS}/req_${i}.json" \
      -w "%{http_code}" \
      -X POST "${ENFORCER_URL}/api/v1/enforce" \
      -H "Authorization: Bearer ${TEST_JWT}" \
      -H "Content-Type: application/json" \
      -d "$PROMPT_PAYLOAD" 2>/dev/null || echo "000")
    END=$(($(date +%s%N) / 1000000))
    LATENCY=$((END - START))
    echo "${HTTP}|${LATENCY}" > "${TMPDIR_RESULTS}/meta_${i}.txt"
  ) &
  PIDS+=($!)
done

# Wait for all parallel requests
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# ── Analyze results ───────────────────────────────────────────
echo -e "\n${BOLD}[RESULTS]${NC}"

TOTAL_REQS=0
SUCCESS_REQS=0
CACHED_REQS=0
TOTAL_LATENCY=0
MIN_LATENCY=99999
MAX_LATENCY=0

for i in $(seq 1 "$CONCURRENCY"); do
  META_FILE="${TMPDIR_RESULTS}/meta_${i}.txt"
  if [[ -f "$META_FILE" ]]; then
    IFS='|' read -r HTTP LATENCY < "$META_FILE"
    ((TOTAL_REQS++))
    if [[ "$HTTP" == "200" ]]; then
      ((SUCCESS_REQS++))
      ((TOTAL_LATENCY += LATENCY))
      [[ $LATENCY -lt $MIN_LATENCY ]] && MIN_LATENCY=$LATENCY
      [[ $LATENCY -gt $MAX_LATENCY ]] && MAX_LATENCY=$LATENCY

      # Check for cache indicator in response
      RESULT_FILE="${TMPDIR_RESULTS}/req_${i}.json"
      if [[ -f "$RESULT_FILE" ]]; then
        IS_CACHED=$(jq -r '.cached // false' "$RESULT_FILE" 2>/dev/null || echo "false")
        [[ "$IS_CACHED" == "true" ]] && ((CACHED_REQS++))
      fi

      printf "  Request %02d: HTTP %s | %dms%s\n" \
        "$i" "$HTTP" "$LATENCY" \
        "$([[ "${IS_CACHED:-false}" == "true" ]] && echo " [CACHE HIT]" || echo "")"
    else
      printf "  Request %02d: HTTP %s | FAILED\n" "$i" "$HTTP"
    fi
  fi
done

# ── Summary metrics ───────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

AVG_LATENCY=$(( TOTAL_LATENCY / (SUCCESS_REQS > 0 ? SUCCESS_REQS : 1) ))
HIT_RATE=$(( CACHED_REQS * 100 / (SUCCESS_REQS > 0 ? SUCCESS_REQS : 1) ))

echo -e "  Cold latency:     ${COLD_LATENCY}ms"
echo -e "  Requests:         ${SUCCESS_REQS}/${CONCURRENCY} succeeded"
echo -e "  Cache hits:       ${CACHED_REQS}/${SUCCESS_REQS} (${HIT_RATE}%)"
echo -e "  Avg latency:      ${AVG_LATENCY}ms"
echo -e "  Min / Max:        ${MIN_LATENCY}ms / ${MAX_LATENCY}ms"

echo ""

# ── Target checks ─────────────────────────────────────────────
TARGET_PASS=0
TARGET_FAIL=0

if [[ $HIT_RATE -ge 90 ]]; then
  echo -e "  ${GREEN}✓${NC} Cache hit rate: ${HIT_RATE}% ≥ 90% target"
  ((TARGET_PASS++))
else
  echo -e "  ${RED}✗${NC} Cache hit rate: ${HIT_RATE}% < 90% target"
  ((TARGET_FAIL++))
fi

if [[ $AVG_LATENCY -lt 200 ]]; then
  echo -e "  ${GREEN}✓${NC} Avg cached latency: ${AVG_LATENCY}ms < 200ms target"
  ((TARGET_PASS++))
else
  echo -e "  ${YELLOW}⚠${NC} Avg cached latency: ${AVG_LATENCY}ms ≥ 200ms target"
  ((TARGET_FAIL++))
fi

echo ""
if [[ $TARGET_FAIL -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}  ✓ ALL PERFORMANCE TARGETS MET${NC}"
else
  echo -e "${YELLOW}${BOLD}  ⚠ $TARGET_FAIL PERFORMANCE TARGET(S) MISSED — review Redis config${NC}"
fi
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

rm -rf "${TMPDIR_RESULTS}"
exit $([[ $TARGET_FAIL -eq 0 ]] && echo 0 || echo 1)
