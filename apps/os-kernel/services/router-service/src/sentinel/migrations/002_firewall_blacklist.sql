-- =============================================================================
-- PHASE 3.2: SENTINEL-02 THE ENFORCER — Firewall Blacklist Migration
-- @migration 002_firewall_blacklist
-- @description Persistent IP blacklist. Entries are written by enforcerAgent
--              and checked by the firewallGuard middleware on every request.
--              Entries have a mandatory expiry date — no permanent blocks
--              without a human-in-the-loop review (the Manual Override UI).
-- =============================================================================

CREATE TABLE IF NOT EXISTS firewall_blacklist (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address    INET          NOT NULL,
  reason        TEXT          NOT NULL,
  blocked_by    TEXT          NOT NULL DEFAULT 'Sentinel-02/Enforcer',
  risk_score    FLOAT,
  threat_ref    UUID,                   -- FK to threat_events.id that triggered block
  expires_at    TIMESTAMPTZ   NOT NULL, -- All blocks MUST expire; enforced at insert
  unblocked_at  TIMESTAMPTZ,            -- Set by Manual Override (Unblock)
  unblocked_by  TEXT,                   -- Engineer identifier for the override
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION firewall_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_firewall_updated_at ON firewall_blacklist;
CREATE TRIGGER trg_firewall_updated_at
  BEFORE UPDATE ON firewall_blacklist
  FOR EACH ROW EXECUTE FUNCTION firewall_set_updated_at();

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Hot path: checked on every incoming request
CREATE INDEX IF NOT EXISTS idx_firewall_ip_active
  ON firewall_blacklist (ip_address)
  WHERE unblocked_at IS NULL AND expires_at > NOW();

-- Dashboard: list recent blocks sorted by creation
CREATE INDEX IF NOT EXISTS idx_firewall_created
  ON firewall_blacklist (created_at DESC);

-- Sentinel-02 runner: scan for Enforcer entries that triggered from threat_events
CREATE INDEX IF NOT EXISTS idx_firewall_threat_ref
  ON firewall_blacklist (threat_ref)
  WHERE threat_ref IS NOT NULL;

-- ── Helper: purge expired blocks ───────────────────────────────────────────────
-- Called by the retention sweeper or a separate cron. Safe to run anytime.

CREATE OR REPLACE FUNCTION purge_expired_firewall_blocks()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM firewall_blacklist
  WHERE expires_at <= NOW() AND unblocked_at IS NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ── Seed Enforcer row into sentinel_registry (idempotent) ──────────────────────

INSERT INTO sentinel_registry (id, name, capability, status, success_rate)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'Sentinel-02 / The Enforcer',
  'Automated IP blocking for SUSPICIOUS_ENTITY events with risk_score > 85',
  'IDLE',
  0.0
)
ON CONFLICT (id) DO NOTHING;
