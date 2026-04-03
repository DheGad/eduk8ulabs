#!/usr/bin/env bash
# =============================================================
# scripts/check-billing-ledger.sh
# Revenue Log Verification — Streetmp OS
# =============================================================
# Queries the enterprise_billing_ledger to verify that recent
# smoke test / telemetry executions were correctly billed.
#
# Usage:
#   # Uses DB_* env vars from .env.prod:
#   source .env.prod && bash scripts/check-billing-ledger.sh
#
#   # Or pass a node ID directly:
#   NODE_ID=test-node bash scripts/check-billing-ledger.sh
#
# Requirements: psql (PostgreSQL client)
# =============================================================

set -euo pipefail

NODE_ID="${NODE_ID:-test-node}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-streetmp_os}"
DB_USER="${DB_USER:-streetmp}"
DB_PASS="${DB_PASS:-}"

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

PSQL="psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
export PGPASSWORD="$DB_PASS"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Streetmp OS — Enterprise Billing Ledger Audit${NC}"
echo -e "  Node: $NODE_ID | DB: $DB_HOST/$DB_NAME"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 1. Recent ledger entries for the node ─────────────────────
echo -e "\n${BOLD}[1/4] Last 10 Billing Events for node: $NODE_ID${NC}"
$PSQL -c "
SELECT
  id,
  period_start::date                AS date,
  total_input_tokens                AS in_tok,
  total_output_tokens               AS out_tok,
  total_cost_usd::NUMERIC(10,4)     AS cost_usd,
  node_status
FROM enterprise_billing_ledger
WHERE node_id = '${NODE_ID}'
ORDER BY period_start DESC
LIMIT 10;" 2>/dev/null || echo "  (table empty or node not found)"

# ── 2. Aggregate token spend in last 24 hours ─────────────────
echo -e "\n${BOLD}[2/4] Token Spend — Last 24 Hours${NC}"
$PSQL -c "
SELECT
  node_id,
  SUM(total_input_tokens)           AS total_in_tokens,
  SUM(total_output_tokens)          AS total_out_tokens,
  SUM(total_cost_usd)::NUMERIC(10,4) AS total_cost_usd
FROM enterprise_billing_ledger
WHERE period_start >= NOW() - INTERVAL '24 hours'
GROUP BY node_id
ORDER BY total_cost_usd DESC;" 2>/dev/null || echo "  (no data in last 24h)"

# ── 3. Usage logs linked to this node's executions ────────────
echo -e "\n${BOLD}[3/4] Recent Execution Traces (last 5)${NC}"
$PSQL -c "
SELECT
  ul.id,
  ul.user_id,
  ul.model_used,
  ul.input_tokens,
  ul.output_tokens,
  ul.created_at::timestamp(0)       AS executed_at
FROM usage_logs ul
JOIN enterprise_nodes en ON en.owner_user_id = ul.user_id
WHERE en.node_id = '${NODE_ID}'
ORDER BY ul.created_at DESC
LIMIT 5;" 2>/dev/null || echo "  (no usage logs found for this node)"

# ── 4. Revenue summary across all nodes ───────────────────────
echo -e "\n${BOLD}[4/4] Total Revenue Summary (All Nodes)${NC}"
$PSQL -c "
SELECT
  COUNT(DISTINCT node_id)           AS active_nodes,
  SUM(total_input_tokens)           AS total_in_tokens,
  SUM(total_output_tokens)          AS total_out_tokens,
  SUM(total_cost_usd)::NUMERIC(12,4) AS total_revenue_usd
FROM enterprise_billing_ledger;" 2>/dev/null || echo "  (table empty)"

echo ""
echo -e "${GREEN}${BOLD}  ✓ Billing audit complete${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
