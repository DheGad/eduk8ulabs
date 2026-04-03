# Streetmp OS — Master Operations Manual

> **Classification:** Internal / CEO-Level Access Only  
> **Last Updated:** 2026-03-22  
> Covers the complete operational runbook for a self-hosted Streetmp OS deployment.

---

## Table of Contents

1. [Stack Overview](#1-stack-overview)
2. [Daily Operations](#2-daily-operations)
3. [The Master Kill-Switch (Manual Node Suspension)](#3-the-master-kill-switch)
4. [Manual Payout Reconciliation](#4-manual-payout-reconciliation)
5. [Emergency Key Rotation](#5-emergency-key-rotation)
6. [5-Minute Disaster Recovery Plan](#6-5-minute-disaster-recovery-plan)
7. [Service Restart Procedures](#7-service-restart-procedures)
8. [Monitoring & Alerting](#8-monitoring--alerting)

---

## 1. Stack Overview

| Service | Port | Role |
|---|---|---|
| `caddy` | 80, 443 | TLS termination, rate limiting, routing |
| `web` | 3000 | Next.js 15 frontend |
| `enforcer-service` | 4001 | LLM execution + schema validation |
| `router-service` | 4002 | LLM provider routing + semantic cache |
| `usage-service` | 4004 | Token billing + enterprise telemetry |
| `trust-service` | 4005 | HCQ scoring + Stripe escrow |
| `sanitizer-service` | 4006 | PII scrubbing |
| `postgres-vault` | **internal** | Primary database |
| `redis-cache` | **internal** | Semantic cache |

**Network Rule:** Only Caddy exposes public ports. All other services are on the internal `streetmp_internal` bridge.

---

## 2. Daily Operations

```bash
# Check all service health
docker compose -f docker-compose.prod.yml ps

# Tail all logs (Ctrl+C to exit)
docker compose -f docker-compose.prod.yml logs -f

# Tail a specific service
docker compose -f docker-compose.prod.yml logs -f trust-service

# Run the smoke test
bash scripts/smoke-test.sh

# Check billing ledger
source .env.prod && bash scripts/check-billing-ledger.sh
```

---

## 3. The Master Kill-Switch

### 3a. Suspend a Node via API (Recommended)

```bash
# Obtain an admin JWT first (via /auth/login with an admin-tier account)
ADMIN_JWT="eyJ..."

# Suspend node
curl -X POST https://localhost:4004/api/v1/admin/nodes/NODE_ID_HERE/status \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": "suspended"}'

# Reactivate node
curl -X POST https://localhost:4004/api/v1/admin/nodes/NODE_ID_HERE/status \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'
```

**Effect:** Within the next heartbeat cycle (~60s), the Enforcer Service will detect the suspended status and return `402 NODE_SUSPENDED` on all execution attempts. No AI calls will be made past that point.

### 3b. Suspend a Node via Direct DB (Emergency CLI)

Use this if the Usage Service API is unavailable.

```bash
# Connect to the DB
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d $DB_NAME

# Suspend
UPDATE enterprise_nodes SET is_active = false, updated_at = NOW()
WHERE node_id = 'NODE_ID_HERE';

# Verify
SELECT node_id, is_active, updated_at FROM enterprise_nodes
WHERE node_id = 'NODE_ID_HERE';

\q
```

> **⚠ Important:** After a direct DB change, the in-memory cache in `telemetry.ts` won't update until the next heartbeat. To force an immediate block, restart the Enforcer:
> ```bash
> docker compose -f docker-compose.prod.yml restart enforcer-service
> ```

### 3c. Nuclear Option — Block All Traffic Instantly

If you need to immediately cut off ALL AI executions (e.g., a breach is detected):

```bash
# Stop the Enforcer entirely (all new /api/v1/enforce calls will 503)
docker compose -f docker-compose.prod.yml stop enforcer-service

# Caddy will continue serving the web frontend — users will see
# a graceful error on execution attempts

# To restore:
docker compose -f docker-compose.prod.yml start enforcer-service
```

---

## 4. Manual Payout Reconciliation

### 4a. Check Pending Escrow Contracts

```bash
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d $DB_NAME -c "
SELECT
  id,
  client_id,
  freelancer_id,
  amount_cents / 100.0 AS amount_usd,
  status,
  stripe_payment_intent_id,
  created_at::date
FROM escrow_contracts
WHERE status NOT IN ('validated_and_released', 'disputed')
ORDER BY created_at DESC
LIMIT 20;"
```

### 4b. Manually Release an Escrow (Emergency)

Only use this if the Enforcer failed to trigger auto-release after a verified job.

```bash
# Get the escrow ID and payment intent ID first (from query above)
ESCROW_ID="uuid-here"
PAYMENT_INTENT_ID="pi_..."

# Call the internal verify-and-release endpoint
curl -X POST http://localhost:4005/internal/trust/verify-and-release \
  -H "x-internal-service-token: $INTERNAL_ROUTER_SECRET" \
  -H "Content-Type: application/json" \
  -d "{
    \"escrow_id\": \"$ESCROW_ID\",
    \"release_trace_id\": \"manual-ops-release\",
    \"verified_output\": {\"manual_release\": true, \"operator\": \"ops\"}
  }"
```

### 4c. Trigger a Stripe Balance Payout to Engineer

```bash
# Get the engineer's Stripe Connect ID from DB
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d $DB_NAME -c "
SELECT id, email, stripe_connect_id, payouts_enabled
FROM users WHERE stripe_connect_id IS NOT NULL;"

# Trigger manual payout via Stripe CLI (install: https://stripe.com/docs/stripe-cli)
stripe payouts create \
  --amount=10000 \
  --currency=usd \
  --stripe-account="acct_..."   # The engineer's connect ID
```

---

## 5. Emergency Key Rotation

### 5a. Rotate `JWT_SECRET`

> **⚠ IMPACT:** All currently logged-in users will be logged out instantly. Plan for off-peak hours.

```bash
# 1. Generate a new secret (minimum 64 chars)
NEW_JWT_SECRET=$(openssl rand -hex 64)
echo "New JWT_SECRET: $NEW_JWT_SECRET"

# 2. Update .env.prod
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW_JWT_SECRET|" .env.prod

# 3. Validate no other issues
bash scripts/validate-prod-env.sh

# 4. Rolling restart (each service re-reads env vars)
docker compose -f docker-compose.prod.yml up -d --force-recreate \
  enforcer-service trust-service usage-service router-service web

# 5. Monitor for auth errors in first 2 minutes
docker compose -f docker-compose.prod.yml logs -f | grep -i "jwt\|auth\|unauthorized"
```

### 5b. Rotate `STRIPE_SECRET_KEY`

```bash
# 1. Generate new key via Stripe Dashboard
#    https://dashboard.stripe.com/apikeys
#    → "Roll key" → save the new sk_live_... key

# 2. Update .env.prod
sed -i "s|^STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=sk_live_NEW_KEY|" .env.prod

# 3. Restart only the Trust Service (only service with Stripe access)
docker compose -f docker-compose.prod.yml up -d --force-recreate trust-service

# 4. Update the Stripe Webhook Endpoint signature in Stripe Dashboard
#    (new endpoint secret will be whsec_NEW...)
sed -i "s|^STRIPE_WEBHOOK_SECRET=.*|STRIPE_WEBHOOK_SECRET=whsec_NEW|" .env.prod
docker compose -f docker-compose.prod.yml up -d --force-recreate trust-service
```

### 5c. Rotate `INTERNAL_ROUTER_SECRET`

```bash
NEW_INTERNAL_SECRET=$(openssl rand -hex 32)

# Update .env.prod
sed -i "s|^INTERNAL_ROUTER_SECRET=.*|INTERNAL_ROUTER_SECRET=$NEW_INTERNAL_SECRET|" .env.prod

# Restart ALL microservices (they all check this secret)
docker compose -f docker-compose.prod.yml up -d --force-recreate \
  enforcer-service trust-service usage-service router-service sanitizer-service
```

### 5d. Rotate `DB_PASS` (Database Password)

> **⚠ HIGH RISK:** This requires a full stack restart. Schedule a maintenance window.

```bash
NEW_DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | head -c 32)

# 1. Change password IN the running DB first
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d $DB_NAME -c \
  "ALTER USER $DB_USER WITH PASSWORD '$NEW_DB_PASS';"

# 2. Update .env.prod
sed -i "s|^DB_PASS=.*|DB_PASS=$NEW_DB_PASS|" .env.prod

# 3. Restart all services that use DB
docker compose -f docker-compose.prod.yml up -d --force-recreate \
  enforcer-service trust-service usage-service router-service

# 4. Verify connectivity
bash scripts/smoke-test.sh
```

---

## 6. 5-Minute Disaster Recovery Plan

### Scenario: Complete Server Failure

```
T+0:00  Detect outage (monitoring alert or user report)
T+0:30  SSH into the server
T+1:00  Check Docker status:
        docker compose -f docker-compose.prod.yml ps
T+1:30  If containers are stopped, check why:
        docker compose -f docker-compose.prod.yml logs --tail=50
T+2:00  If disk full → clear old logs:
        docker system prune -f
T+2:30  Restart the stack:
        docker compose -f docker-compose.prod.yml up -d
T+3:00  Run smoke test:
        bash scripts/smoke-test.sh
T+4:00  Verify Stripe webhooks are re-established in Stripe Dashboard
T+5:00  Confirm green: all checks pass, post status update
```

### Scenario: Database Corruption / Data Loss

```bash
# 1. Stop all services immediately (prevent further writes)
docker compose -f docker-compose.prod.yml stop \
  enforcer-service trust-service usage-service router-service

# 2. Backup the current (possibly corrupt) state
docker compose -f docker-compose.prod.yml exec postgres-vault \
  pg_dump -U $DB_USER $DB_NAME > /tmp/emergency_backup_$(date +%s).sql

# 3. Restore from last known-good backup
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME}_old;"
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d postgres -c \
  "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_old;"
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME;"
# Restore from backup file (mount it into the container):
docker cp /backups/latest.sql streetmp_postgres_prod:/tmp/restore.sql
docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d $DB_NAME -f /tmp/restore.sql

# 4. Restart microservices
docker compose -f docker-compose.prod.yml up -d

# 5. Verify
bash scripts/smoke-test.sh
bash scripts/check-billing-ledger.sh
```

### Scenario: Stripe Webhook Failure (Funds Stuck in Escrow)

```bash
# Check for stuck escrow contracts
source .env.prod && docker compose -f docker-compose.prod.yml exec postgres-vault \
  psql -U $DB_USER -d $DB_NAME -c "
SELECT id, status, created_at, stripe_payment_intent_id
FROM escrow_contracts
WHERE status = 'funded'
  AND created_at < NOW() - INTERVAL '2 days';"

# Re-send the webhook from Stripe Dashboard:
# Dashboard → Developers → Webhooks → [your endpoint] → Recent events → Resend

# Or force-release (see Section 4b above)
```

---

## 7. Service Restart Procedures

```bash
# Restart a single service (zero-downtime for stateless services)
docker compose -f docker-compose.prod.yml restart enforcer-service

# Rolling restart of all microservices (keeps Caddy/Postgres/Redis up)
for svc in enforcer-service router-service usage-service trust-service sanitizer-service web; do
  echo "Restarting $svc..."
  docker compose -f docker-compose.prod.yml up -d --force-recreate "$svc"
  sleep 5  # Wait for healthcheck before proceeding
done

# Full stack restart (maintenance window required)
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

---

## 8. Monitoring & Alerting

### Key Metrics to Watch

| Metric | Watch For | Command |
|---|---|---|
| Enforcer P95 latency | > 5s | `docker logs streetmp_enforcer_prod \| grep ms` |
| Redis memory | > 400MB | `docker exec streetmp_redis_prod redis-cli -a $REDIS_PASSWORD info memory` |
| Postgres connections | > 80% of max | `psql ... -c "SELECT count(*) FROM pg_stat_activity;"` |
| Disk usage | > 80% | `df -h` |
| Escrow stuck > 48h | Any | See Section 6 Stripe scenario above |

### Quick Log Search

```bash
# Find all errors in the last hour
docker compose -f docker-compose.prod.yml logs --since=1h 2>&1 | grep -i "error\|fatal\|panic"

# Find all blocked executions (NODE_SUSPENDED)
docker compose -f docker-compose.prod.yml logs --since=24h enforcer-service \
  | grep "NODE_SUSPENDED"

# Find all Stripe webhook events
docker compose -f docker-compose.prod.yml logs --since=24h trust-service \
  | grep "EscrowBridge:webhook"
```

---

*For security incidents, escalate immediately. Rotate affected secrets first, investigate second.*
