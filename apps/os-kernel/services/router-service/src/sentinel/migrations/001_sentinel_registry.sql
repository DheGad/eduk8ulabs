-- =============================================================================
-- PHASE 3: THE SENTINEL LAYER — Agent Registry Migration
-- @migration 001_sentinel_registry
-- @description Persists the live state and metadata for all Sentinel agents.
--              Replaces the in-memory agentRegistry.ts for durable, dashboard-
--              visible state. Runs on the shared StreetMP PostgreSQL database.
-- =============================================================================

-- ── 1. Status enum ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentinel_status') THEN
    CREATE TYPE sentinel_status AS ENUM ('ACTIVE', 'IDLE', 'ERROR');
  END IF;
END
$$;

-- ── 2. Registry table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sentinel_registry (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  capability    TEXT          NOT NULL,
  status        sentinel_status NOT NULL DEFAULT 'IDLE',
  last_run      TIMESTAMPTZ,
  success_rate  FLOAT         NOT NULL DEFAULT 0.0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 3. Auto-update updated_at on every write ──────────────────────────────────

CREATE OR REPLACE FUNCTION sentinel_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sentinel_updated_at ON sentinel_registry;
CREATE TRIGGER trg_sentinel_updated_at
  BEFORE UPDATE ON sentinel_registry
  FOR EACH ROW EXECUTE FUNCTION sentinel_set_updated_at();

-- ── 4. Seed Sentinel-01 'The Auditor' ─────────────────────────────────────────

INSERT INTO sentinel_registry (id, name, capability, status, success_rate)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Sentinel-01 / The Auditor',
  'Low-and-Slow threat detection across compliance_events and threat_events tables',
  'IDLE',
  0.0
)
ON CONFLICT (id) DO NOTHING;

-- ── 5. Index for dashboard polling ────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sentinel_registry_status ON sentinel_registry(status);
CREATE INDEX IF NOT EXISTS idx_sentinel_registry_last_run ON sentinel_registry(last_run DESC NULLS LAST);
