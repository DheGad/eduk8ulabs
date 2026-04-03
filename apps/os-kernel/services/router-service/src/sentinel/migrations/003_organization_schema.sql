-- =============================================================================
-- PHASE 4: THE ENTERPRISE LAYER — Organization Schema
-- @migration 003_organization_schema
-- @description Introduces the unified 'Organization' multi-tenant model,
--              replacing legacy single-tenant stubs. Every resource in the
--              system is scoped to an org_id going forward.
--
-- EXECUTION ORDER:
--   1. Create enums
--   2. Create organizations (parent table)
--   3. Create organization_members (membership + roles)
--   4. Create organization_invites (invite flow)
--   5. ADD org_id to existing resource tables (non-destructive; nullable first)
--   6. Add FK constraints
--   7. Add indexes
-- =============================================================================

-- ── 1. Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
    CREATE TYPE plan_tier AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
    CREATE TYPE org_role AS ENUM ('OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER');
  END IF;
END $$;

-- ── 2. organizations ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,                 -- URL-safe identifier
  plan_tier   plan_tier   NOT NULL DEFAULT 'FREE',
  -- Billing linkage (populated when Stripe/Razorpay customer is created)
  stripe_customer_id TEXT,
  -- Soft-delete: archived orgs are hidden but data is retained for billing
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION orgs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_orgs_updated_at ON organizations;
CREATE TRIGGER trg_orgs_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION orgs_set_updated_at();

-- ── 3. organization_members ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_members (
  id         UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID       NOT NULL,
  org_id     UUID       NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role       org_role   NOT NULL DEFAULT 'VIEWER',
  -- Prevent duplicate membership rows
  UNIQUE (user_id, org_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION members_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_members_updated_at ON organization_members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION members_set_updated_at();

-- ── 4. organization_invites ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_invites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        NOT NULL,
  org_id     UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role       org_role    NOT NULL DEFAULT 'DEVELOPER',
  token      TEXT        NOT NULL UNIQUE,                   -- secure random token
  invited_by UUID        NOT NULL,                          -- user_id of sender
  accepted_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. Add org_id to existing resource tables (nullable → backfill → constrain)

-- threat_events
ALTER TABLE threat_events
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- execution_costs
ALTER TABLE execution_costs
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- usage_logs
ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- api_keys
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- ── 6. FK constraints (deferred so existing rows are untouched for now)
--     In production: backfill org_id on all rows first, THEN add NOT NULL.
--     We add the FKs now so new rows are enforced immediately.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_threat_events_org'
  ) THEN
    ALTER TABLE threat_events
      ADD CONSTRAINT fk_threat_events_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_execution_costs_org'
  ) THEN
    ALTER TABLE execution_costs
      ADD CONSTRAINT fk_execution_costs_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_usage_logs_org'
  ) THEN
    ALTER TABLE usage_logs
      ADD CONSTRAINT fk_usage_logs_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_api_keys_org'
  ) THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT fk_api_keys_org
      FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 7. Indexes ────────────────────────────────────────────────────────────────

-- org lookup by slug (used in auth and subdomain routing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations (slug);

-- member lookup: "which orgs does this user belong to?"
CREATE INDEX IF NOT EXISTS idx_org_members_user
  ON organization_members (user_id);

-- member lookup: "who is in this org?"
CREATE INDEX IF NOT EXISTS idx_org_members_org
  ON organization_members (org_id);

-- invite lookup: claim flow by token
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_invites_token
  ON organization_invites (token)
  WHERE accepted_at IS NULL AND expires_at > NOW();

-- Resource scoping (hot path for every API query)
CREATE INDEX IF NOT EXISTS idx_threat_events_org         ON threat_events      (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_execution_costs_org       ON execution_costs    (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_logs_org            ON usage_logs         (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_org              ON api_keys           (org_id) WHERE org_id IS NOT NULL;

-- firewall_blacklist (Phase 3.2) — add org_id for per-org block lists
ALTER TABLE firewall_blacklist ADD COLUMN IF NOT EXISTS org_id UUID
  REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_firewall_org ON firewall_blacklist (org_id) WHERE org_id IS NOT NULL;
