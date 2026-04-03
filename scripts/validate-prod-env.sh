#!/usr/bin/env bash
# =============================================================
# scripts/validate-prod-env.sh
# Pre-flight environment validation for Streetmp OS production.
# =============================================================
# Run this BEFORE `docker compose -f docker-compose.prod.yml up -d`
#
# Exit codes:
#   0 — All checks passed, safe to boot
#   1 — One or more critical checks failed, DO NOT boot
#
# Usage:
#   bash scripts/validate-prod-env.sh
#   bash scripts/validate-prod-env.sh .env.custom   (optional path arg)
# =============================================================

set -euo pipefail

ENV_FILE="${1:-.env.prod}"
ERRORS=0
WARNINGS=0

# ── Terminal colors ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

error()   { echo -e "  ${RED}✗ ERROR:${NC}   $1"; ((ERRORS++)); }
warn()    { echo -e "  ${YELLOW}⚠ WARNING:${NC} $1"; ((WARNINGS++)); }
ok()      { echo -e "  ${GREEN}✓ OK:${NC}      $1"; }
section() { echo -e "\n${BOLD}[$1]${NC}"; }

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Streetmp OS — Production Environment Validator${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Load the env file ────────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "\n${RED}FATAL: '$ENV_FILE' not found.${NC}"
  echo "  Copy .env.example → $ENV_FILE and fill in all values."
  exit 1
fi

echo -e "\nLoading: ${BOLD}$ENV_FILE${NC}"
set -o allexport
# shellcheck disable=SC1090
source "$ENV_FILE"
set +o allexport

# =============================================================
# SECTION 1: STRIPE KEYS
# =============================================================
section "Stripe Payment Keys"

# Check for TEST keys in production
if [[ "${STRIPE_SECRET_KEY:-}" == sk_test_* ]]; then
  error "STRIPE_SECRET_KEY is a TEST key (sk_test_...). Use the live key (sk_live_...) in production."
fi
if [[ "${STRIPE_SECRET_KEY:-}" == sk_live_* ]]; then
  ok "STRIPE_SECRET_KEY is a live key."
elif [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  error "STRIPE_SECRET_KEY is not set."
fi

if [[ "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" == pk_test_* ]]; then
  error "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a TEST key (pk_test_...). Use the live key (pk_live_...) in production."
fi
if [[ "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" == pk_live_* ]]; then
  ok "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a live key."
elif [[ -z "${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" ]]; then
  error "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set."
fi

if [[ -z "${STRIPE_WEBHOOK_SECRET:-}" ]]; then
  error "STRIPE_WEBHOOK_SECRET is not set. Webhook signature verification will fail."
elif [[ "${STRIPE_WEBHOOK_SECRET:-}" == whsec_* ]]; then
  ok "STRIPE_WEBHOOK_SECRET is present."
else
  warn "STRIPE_WEBHOOK_SECRET format looks unexpected (expected whsec_...)."
fi

# =============================================================
# SECTION 2: LLM API KEYS
# =============================================================
section "LLM Provider API Keys"

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  error "OPENAI_API_KEY is not set. GPT-4o / GPT-4 Turbo routing will fail."
elif [[ "${OPENAI_API_KEY:-}" == sk-* ]]; then
  ok "OPENAI_API_KEY is present."
else
  warn "OPENAI_API_KEY format is unexpected (expected sk-...)."
fi

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  warn "ANTHROPIC_API_KEY is not set. Claude model routing will be unavailable."
else
  ok "ANTHROPIC_API_KEY is present."
fi

# =============================================================
# SECTION 3: DATABASE
# =============================================================
section "Database Configuration"

for var in DB_USER DB_PASS DB_NAME DB_HOST; do
  if [[ -z "${!var:-}" ]]; then
    error "$var is not set."
  else
    ok "$var is set."
  fi
done

# Protect against obvious dev passwords
if [[ "${DB_PASS:-}" == *"dev"* || "${DB_PASS:-}" == *"local"* || "${DB_PASS:-}" == *"password"* ]]; then
  error "DB_PASS looks like a development password. Use a strong random password in production."
fi

# =============================================================
# SECTION 4: SECURITY SECRETS
# =============================================================
section "Security Secrets"

if [[ -z "${JWT_SECRET:-}" ]]; then
  error "JWT_SECRET is not set. All authentication will fail."
elif [[ ${#JWT_SECRET} -lt 32 ]]; then
  error "JWT_SECRET is too short (${#JWT_SECRET} chars). Use at least 32 random characters."
else
  ok "JWT_SECRET is present (${#JWT_SECRET} chars)."
fi

if [[ -z "${INTERNAL_ROUTER_SECRET:-}" ]]; then
  error "INTERNAL_ROUTER_SECRET is not set. Internal service authentication will fail."
else
  ok "INTERNAL_ROUTER_SECRET is present."
fi

if [[ -z "${ENTERPRISE_NODE_SECRET:-}" ]]; then
  warn "ENTERPRISE_NODE_SECRET is not set. Enterprise node telemetry will not work."
else
  ok "ENTERPRISE_NODE_SECRET is present."
fi

# =============================================================
# SECTION 5: REDIS
# =============================================================
section "Redis Configuration"

if [[ -z "${REDIS_URL:-}" ]]; then
  error "REDIS_URL is not set. The semantic cache will be disabled."
else
  ok "REDIS_URL is set."
fi

if [[ -z "${REDIS_PASSWORD:-}" ]]; then
  error "REDIS_PASSWORD is not set. Redis will start without authentication."
else
  ok "REDIS_PASSWORD is set."
fi

# =============================================================
# SECTION 6: APPLICATION URLS
# =============================================================
section "Application URLs"

if [[ "${NEXT_PUBLIC_APP_URL:-}" != https://* ]]; then
  error "NEXT_PUBLIC_APP_URL should be an HTTPS URL in production (got: ${NEXT_PUBLIC_APP_URL:-unset})."
else
  ok "NEXT_PUBLIC_APP_URL uses HTTPS: ${NEXT_PUBLIC_APP_URL}"
fi

# =============================================================
# SECTION 7: LEAKED DEV ARTIFACTS CHECK
# =============================================================
section "Leaked Dev Artifacts"

# Check for localhost in production URLs
for var in NEXT_PUBLIC_TRUST_SERVICE_URL NEXT_PUBLIC_USAGE_SERVICE_URL; do
  if [[ "${!var:-}" == *"localhost"* ]]; then
    error "$var points to localhost. This will not work in production."
  elif [[ -n "${!var:-}" ]]; then
    ok "$var → ${!var}"
  fi
done

# Check for obvious placeholder values
for var in JWT_SECRET DB_PASS STRIPE_SECRET_KEY; do
  if [[ "${!var:-}" == *"CHANGE_ME"* || "${!var:-}" == *"YOUR_"* || "${!var:-}" == *"REPLACE"* ]]; then
    error "$var contains a placeholder value. Replace it before deploying."
  fi
done

# =============================================================
# FINAL REPORT
# =============================================================
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ $ERRORS -gt 0 ]]; then
  echo -e "${RED}${BOLD}  ✗ VALIDATION FAILED: $ERRORS error(s), $WARNINGS warning(s)${NC}"
  echo -e "  Fix all errors before booting the production stack."
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  exit 1
else
  if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}${BOLD}  ⚠ VALIDATION PASSED WITH $WARNINGS WARNING(S)${NC}"
    echo "  Review warnings above, then proceed with deployment."
  else
    echo -e "${GREEN}${BOLD}  ✓ ALL CHECKS PASSED — Safe to boot production stack${NC}"
  fi
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  exit 0
fi
