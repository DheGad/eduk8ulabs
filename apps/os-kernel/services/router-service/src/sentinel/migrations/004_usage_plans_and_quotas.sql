-- =============================================================================
-- PHASE 5: SCALE & API MARKETPLACE
-- @migration 004_usage_plans_and_quotas
-- @description
--   Adds subscription_plans, org_webhook_endpoints, and org_usage_quotas tables.
--   The Usage Guard reads org_usage_quotas on every /v1/chat execution path
--   and returns HTTP 429 when limit_reached_at is set.
--
-- PLAN SEEDING:
--   Stripe price_id values use the test-mode pattern (price_test_...).
--   Replace with live price IDs in production. Seeded rows are idempotent.
-- =============================================================================

-- ── 1. subscription_plans ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT          NOT NULL UNIQUE,          -- "free", "pro", "enterprise"
  display_name    TEXT          NOT NULL,
  monthly_limit   INTEGER       NOT NULL,                 -- max LLM executions / month; -1 = unlimited
  price_monthly   NUMERIC(10,2) NOT NULL DEFAULT 0.00,    -- USD
  -- Stripe price IDs (test-mode format)
  stripe_price_id TEXT,                                   -- monthly billing
  stripe_product_id TEXT,
  -- Feature flags stored as JSON
  features        JSONB         NOT NULL DEFAULT '{}',
  is_public       BOOLEAN       NOT NULL DEFAULT TRUE,    -- show on pricing page
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION plans_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_plans_updated_at ON subscription_plans;
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION plans_set_updated_at();

-- Seed the three canonical plans (idempotent)
INSERT INTO subscription_plans
  (id, name, display_name, monthly_limit, price_monthly, stripe_price_id, stripe_product_id, features)
VALUES
  (
    'a1000000-0000-0000-0000-000000000001',
    'free',
    'Free',
    500,          -- 500 executions/month
    0.00,
    NULL,
    NULL,
    '{"sentinel":false,"webhooks":false,"multi_tenant":false,"sla":"community"}'::jsonb
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'pro',
    'Pro',
    50000,        -- 50,000 executions/month
    49.00,
    'price_test_pro_monthly_49',
    'prod_test_streetmp_pro',
    '{"sentinel":true,"webhooks":true,"multi_tenant":true,"sla":"99.5","custom_models":false}'::jsonb
  ),
  (
    'a3000000-0000-0000-0000-000000000003',
    'enterprise',
    'Enterprise',
    -1,           -- unlimited
    299.00,
    'price_test_enterprise_monthly_299',
    'prod_test_streetmp_enterprise',
    '{"sentinel":true,"webhooks":true,"multi_tenant":true,"sla":"99.9","custom_models":true,"byoc":true,"soc2":true}'::jsonb
  )
ON CONFLICT (name) DO UPDATE SET
  monthly_limit     = EXCLUDED.monthly_limit,
  price_monthly     = EXCLUDED.price_monthly,
  stripe_price_id   = EXCLUDED.stripe_price_id,
  stripe_product_id = EXCLUDED.stripe_product_id,
  features          = EXCLUDED.features,
  updated_at        = NOW();

-- ── 2. org_usage_quotas ───────────────────────────────────────────────────────
-- One row per org. Reset by a monthly cron (or Stripe billing-cycle webhook).

CREATE TABLE IF NOT EXISTS org_usage_quotas (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID        NOT NULL UNIQUE
                              REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                   UUID        NOT NULL
                              REFERENCES subscription_plans(id),
  -- Rolling monthly counter
  current_month_executions  INTEGER     NOT NULL DEFAULT 0,
  month_start               DATE        NOT NULL DEFAULT DATE_TRUNC('month', NOW()),
  -- Set when the limit is first breached; cleared on reset
  limit_reached_at          TIMESTAMPTZ,
  -- Stripe subscription linkage
  stripe_subscription_id    TEXT,
  stripe_customer_id        TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION quotas_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_quotas_updated_at ON org_usage_quotas;
CREATE TRIGGER trg_quotas_updated_at
  BEFORE UPDATE ON org_usage_quotas
  FOR EACH ROW EXECUTE FUNCTION quotas_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_quotas_org ON org_usage_quotas (org_id);

-- ── 3. org_webhook_endpoints ──────────────────────────────────────────────────
-- Orgs can register up to N webhook URLs to receive CRITICAL threat alerts.

CREATE TABLE IF NOT EXISTS org_webhook_endpoints (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL,
  -- HMAC-SHA256 signing secret — stored hashed; returned once on creation
  signing_secret_hash TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  -- Delivery tracking
  last_triggered_at  TIMESTAMPTZ,
  last_status_code   INTEGER,
  failure_count      INTEGER NOT NULL DEFAULT 0,
  -- Auto-disable after 5 consecutive failures
  disabled_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION webhooks_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON org_webhook_endpoints;
CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON org_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION webhooks_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_webhooks_org         ON org_webhook_endpoints (org_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_webhooks_org_active  ON org_webhook_endpoints (org_id) WHERE is_active = TRUE AND disabled_at IS NULL;

-- ── 4. Atomic usage increment function ───────────────────────────────────────
-- Called by the Usage Guard on every LLM execution. Returns the updated row.
-- Returns NULL if limit already breached (guard should 429).

CREATE OR REPLACE FUNCTION increment_org_execution(p_org_id UUID)
RETURNS TABLE(
  executions    INTEGER,
  monthly_limit INTEGER,
  is_limited    BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
  v_quota       org_usage_quotas%ROWTYPE;
  v_plan        subscription_plans%ROWTYPE;
  v_new_count   INTEGER;
BEGIN
  -- Lock the quota row for this org (skip-locked in high-concurrency path)
  SELECT * INTO v_quota
  FROM   org_usage_quotas
  WHERE  org_id = p_org_id
  FOR    UPDATE;

  IF NOT FOUND THEN
    -- No quota row — org is on free plan by default, auto-create
    INSERT INTO org_usage_quotas (org_id, plan_id)
    SELECT p_org_id, id FROM subscription_plans WHERE name = 'free' LIMIT 1
    ON CONFLICT (org_id) DO NOTHING
    RETURNING * INTO v_quota;

    SELECT * INTO v_quota FROM org_usage_quotas WHERE org_id = p_org_id FOR UPDATE;
  END IF;

  -- Monthly reset check
  IF v_quota.month_start < DATE_TRUNC('month', NOW()) THEN
    UPDATE org_usage_quotas
    SET current_month_executions = 0,
        month_start              = DATE_TRUNC('month', NOW()),
        limit_reached_at         = NULL,
        updated_at               = NOW()
    WHERE org_id = p_org_id;
    v_quota.current_month_executions := 0;
    v_quota.limit_reached_at         := NULL;
  END IF;

  -- Fetch plan limits
  SELECT * INTO v_plan FROM subscription_plans WHERE id = v_quota.plan_id;

  -- If already 429'd, don't even increment
  IF v_quota.limit_reached_at IS NOT NULL THEN
    RETURN QUERY SELECT v_quota.current_month_executions, v_plan.monthly_limit, TRUE;
    RETURN;
  END IF;

  v_new_count := v_quota.current_month_executions + 1;

  -- Check limit (-1 = unlimited)
  IF v_plan.monthly_limit <> -1 AND v_new_count > v_plan.monthly_limit THEN
    UPDATE org_usage_quotas
    SET current_month_executions = v_new_count,
        limit_reached_at         = NOW(),
        updated_at               = NOW()
    WHERE org_id = p_org_id;

    RETURN QUERY SELECT v_new_count, v_plan.monthly_limit, TRUE;
  ELSE
    UPDATE org_usage_quotas
    SET current_month_executions = v_new_count,
        updated_at               = NOW()
    WHERE org_id = p_org_id;

    RETURN QUERY SELECT v_new_count, v_plan.monthly_limit, FALSE;
  END IF;
END; $$;
