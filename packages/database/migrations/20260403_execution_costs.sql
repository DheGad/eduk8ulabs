-- ============================================================
-- Migration: execution_costs + iam_access_events
-- Created:   2026-04-03
-- Replaces:  Math.random() cost simulation in Dashboard
--            Math.random() session simulation in IAM page
-- ============================================================
-- Run with:
--   psql $DATABASE_URL -f migrations/20260403_execution_costs.sql
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────
-- execution_costs
-- Per-request cost record written by the router-service after
-- every successful model invocation.
-- Denormalized from usage_logs for fast dashboard aggregation.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS execution_costs (
  id            TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- FK to the originating usage_log row (nullable for legacy rows)
  usage_log_id  UUID          REFERENCES usage_logs (id) ON DELETE SET NULL,

  -- The exact model string returned by the router (lowercase)
  -- e.g. 'gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022'
  model_name    TEXT          NOT NULL,

  -- Token accounting
  tokens_in     INTEGER       NOT NULL DEFAULT 0
      CONSTRAINT tokens_in_non_negative CHECK (tokens_in >= 0),
  tokens_out    INTEGER       NOT NULL DEFAULT 0
      CONSTRAINT tokens_out_non_negative CHECK (tokens_out >= 0),

  -- Computed cost in USD, 8 decimal places to handle sub-cent precision
  cost_usd      NUMERIC(14,8) NOT NULL DEFAULT 0.00000000
      CONSTRAINT cost_non_negative CHECK (cost_usd >= 0),

  -- Tenant / user context (nullable for anonymous/internal calls)
  user_id       UUID          REFERENCES users (id) ON DELETE SET NULL,

  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_costs_created_at
    ON execution_costs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_costs_model
    ON execution_costs (model_name);
CREATE INDEX IF NOT EXISTS idx_execution_costs_user
    ON execution_costs (user_id)
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE execution_costs IS
    'Per-request model cost records. Written by the router after each '
    'successful execution. Source of truth for the Dashboard spending widget.';

-- ──────────────────────────────────────────────────────────────
-- iam_access_events
-- Written by the IAM middleware in proxyRoutes.ts on every
-- auth decision (AUTHORIZED / BLOCKED / ESCALATED).
-- Replaces the Math.random() MOCK_USERS loop in iam/page.tsx.
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE iam_action AS ENUM ('AUTHORIZED', 'BLOCKED', 'ESCALATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE idp_provider AS ENUM ('OKTA', 'AZURE_AD', 'GOOGLE', 'INTERNAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS iam_access_events (
  id          TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Identity
  user_id     UUID          REFERENCES users (id) ON DELETE SET NULL,
  email       TEXT,                         -- redacted to user@domain.ext if PII controls active
  provider    idp_provider  NOT NULL DEFAULT 'INTERNAL',
  role        TEXT,                         -- e.g. 'senior-engineer', 'compliance-auditor'
  clearance   TEXT          NOT NULL DEFAULT 'L1_PUBLIC',
                                            -- L1_PUBLIC … L5_SOVEREIGN

  -- Decision
  route       TEXT          NOT NULL,       -- e.g. 'EXECUTE_OPENAI', 'MANAGE_VAULT'
  action      iam_action    NOT NULL,
  reason      TEXT,                         -- human-readable denial reason when BLOCKED

  -- Network context
  source_ip   TEXT,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iam_events_created_at
    ON iam_access_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_iam_events_action
    ON iam_access_events (action);
CREATE INDEX IF NOT EXISTS idx_iam_events_user_id
    ON iam_access_events (user_id)
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE iam_access_events IS
    'IAM authorization decisions. Written by proxyRoutes.ts on every '
    'AUTHORIZED / BLOCKED / ESCALATED check. Source of truth for the '
    'Zero-Trust IAM dashboard page.';

COMMIT;
