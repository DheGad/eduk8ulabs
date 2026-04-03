-- =============================================================================
-- PHASE 5.5: RAZORPAY INDIA INTEGRATION
-- @migration 005_razorpay_india
-- @description
--   Adds billing_provider enum and GSTIN to organizations.
--   Creates razorpay_orders for order tracking and signature verification.
--   Creates razorpay_subscriptions for recurring plan billing.
-- =============================================================================

-- ── 1. billing_provider enum ──────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
    CREATE TYPE billing_provider AS ENUM ('STRIPE', 'RAZORPAY');
  END IF;
END $$;

-- ── 2. Alter organizations ────────────────────────────────────────────────────

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS billing_provider  billing_provider NOT NULL DEFAULT 'STRIPE',
  ADD COLUMN IF NOT EXISTS gstin             TEXT,            -- GST Identification Number (India)
  ADD COLUMN IF NOT EXISTS billing_country   TEXT,            -- ISO-3166-1 alpha-2 (e.g. 'IN', 'US')
  ADD COLUMN IF NOT EXISTS billing_currency  TEXT NOT NULL DEFAULT 'USD'; -- ISO-4217

-- GST validation: 15-char alphanumeric format (Indian standard)
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS chk_gstin_format;

ALTER TABLE organizations
  ADD CONSTRAINT chk_gstin_format
  CHECK (
    gstin IS NULL
    OR (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
  );

-- ── 3. razorpay_orders ────────────────────────────────────────────────────────
-- One row per checkout session. Status mirrors Razorpay's order lifecycle.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rzp_order_status') THEN
    CREATE TYPE rzp_order_status AS ENUM (
      'CREATED',    -- Order created, awaiting payment
      'ATTEMPTED',  -- Payment initiated, not yet captured
      'PAID',       -- Payment captured successfully
      'FAILED',     -- Payment failed / expired
      'REFUNDED'    -- Post-capture refund issued
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS razorpay_orders (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Razorpay identifiers
  razorpay_order_id   TEXT             NOT NULL UNIQUE,   -- order_XXXXX
  razorpay_payment_id TEXT,                               -- pay_XXXXX (set after capture)
  razorpay_signature  TEXT,                               -- stored for audit; verified at capture
  -- Order details
  amount              BIGINT           NOT NULL,           -- paise (100 paise = 1 INR)
  currency            TEXT             NOT NULL DEFAULT 'INR',
  plan_name           TEXT             NOT NULL,
  status              rzp_order_status NOT NULL DEFAULT 'CREATED',
  -- GST fields
  gstin               TEXT,
  gst_amount          BIGINT,                              -- paise
  -- Receipt and notes
  receipt             TEXT,
  notes               JSONB            NOT NULL DEFAULT '{}',
  -- Metadata
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION rzp_orders_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_rzp_orders_updated_at ON razorpay_orders;
CREATE TRIGGER trg_rzp_orders_updated_at
  BEFORE UPDATE ON razorpay_orders
  FOR EACH ROW EXECUTE FUNCTION rzp_orders_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_rzp_orders_org        ON razorpay_orders (org_id);
CREATE INDEX IF NOT EXISTS idx_rzp_orders_rzp_id     ON razorpay_orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_rzp_orders_status     ON razorpay_orders (status);

-- ── 4. razorpay_subscriptions ─────────────────────────────────────────────────
-- For recurring billing via Razorpay Subscriptions API.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rzp_sub_status') THEN
    CREATE TYPE rzp_sub_status AS ENUM (
      'CREATED',
      'AUTHENTICATED',
      'ACTIVE',
      'PENDING',
      'HALTED',
      'CANCELLED',
      'COMPLETED',
      'EXPIRED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS razorpay_subscriptions (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                  UUID           NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  razorpay_subscription_id TEXT          NOT NULL UNIQUE,  -- sub_XXXXX
  plan_id                 TEXT           NOT NULL,          -- Razorpay plan_id
  plan_name               TEXT           NOT NULL,
  status                  rzp_sub_status NOT NULL DEFAULT 'CREATED',
  current_start           TIMESTAMPTZ,
  current_end             TIMESTAMPTZ,
  charge_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rzp_subs_org    ON razorpay_subscriptions (org_id);
CREATE INDEX IF NOT EXISTS idx_rzp_subs_rzp_id ON razorpay_subscriptions (razorpay_subscription_id);

-- ── 5. Helper: detect Indian org and set billing defaults ─────────────────────
-- Called at org creation or when billing_country is updated.

CREATE OR REPLACE FUNCTION set_org_billing_defaults()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.billing_country = 'IN' THEN
    NEW.billing_provider  := 'RAZORPAY';
    NEW.billing_currency  := 'INR';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_org_billing_defaults ON organizations;
CREATE TRIGGER trg_org_billing_defaults
  BEFORE INSERT OR UPDATE OF billing_country ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_org_billing_defaults();
