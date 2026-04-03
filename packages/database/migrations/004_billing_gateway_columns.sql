-- ============================================================
-- MIGRATION: 004_billing_gateway_columns.sql
-- Adds dual-gateway billing fields to the users table.
--
-- IMPORTANT: PostgreSQL requires enum values to be committed
-- before they can be referenced in DML within the same session.
-- This file uses three separate transactions for correctness.
-- ============================================================

-- ═══════════════════════════════════════════════════════════
-- TRANSACTION 1a: Add 'business' enum value
-- Must be committed before any DML references it.
-- ═══════════════════════════════════════════════════════════
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'account_tier'::regtype
      AND enumlabel = 'business'
  ) THEN
    ALTER TYPE account_tier ADD VALUE 'business' AFTER 'pro';
  END IF;
END
$$;
COMMIT;

-- ═══════════════════════════════════════════════════════════
-- TRANSACTION 1b: Add 'sovereign' enum value
-- ═══════════════════════════════════════════════════════════
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'account_tier'::regtype
      AND enumlabel = 'sovereign'
  ) THEN
    ALTER TYPE account_tier ADD VALUE 'sovereign' AFTER 'business';
  END IF;
END
$$;
COMMIT;

-- ═══════════════════════════════════════════════════════════
-- TRANSACTION 2: Add billing columns + indexes
-- ═══════════════════════════════════════════════════════════
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id   VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(64) NULL,
  ADD COLUMN IF NOT EXISTS active_gateway       VARCHAR(10) NULL
    CONSTRAINT active_gateway_check
      CHECK (active_gateway IN ('STRIPE', 'RAZORPAY')),
  ADD COLUMN IF NOT EXISTS api_calls_this_month INTEGER     NOT NULL DEFAULT 0
    CONSTRAINT api_calls_non_negative CHECK (api_calls_this_month >= 0),
  ADD COLUMN IF NOT EXISTS monthly_limit        INTEGER     NOT NULL DEFAULT 100
    CONSTRAINT monthly_limit_positive CHECK (monthly_limit > 0);

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
  ON users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer
  ON users (razorpay_customer_id)
  WHERE razorpay_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_active_gateway
  ON users (active_gateway)
  WHERE active_gateway IS NOT NULL;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- TRANSACTION 3: Seed monthly_limit from account_tier
-- Safe now — all enum values are committed above.
-- Cast to ::text to avoid enum comparison issues.
-- ═══════════════════════════════════════════════════════════
BEGIN;

UPDATE users
SET monthly_limit = CASE account_tier::text
  WHEN 'free'      THEN 100
  WHEN 'pro'       THEN 10000
  WHEN 'business'  THEN 100000
  WHEN 'sovereign' THEN 2147483647
  ELSE 100
END
WHERE monthly_limit = 100;

COMMIT;
