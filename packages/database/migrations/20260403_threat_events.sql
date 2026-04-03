-- ============================================================
-- Migration: threat_events
-- Created:   2026-04-03
-- Purpose:   Persistent storage for Identity Threat Intelligence
--            events — replaces the Math.random() simulation in
--            /dashboard/security/intel.
-- ============================================================

-- Run with:
--   psql $DATABASE_URL -f migrations/20260403_threat_events.sql
-- Or via the migrate_prod.js runner already in this package.
-- ============================================================

BEGIN;

-- ──────────────────────────────────────────────────────────
-- Severity enum (matched to the UI ThreatSeverity type)
-- ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE threat_severity AS ENUM ('LOW', 'MED', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────
-- Threat status enum
-- ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE threat_status AS ENUM ('CLEAR', 'MONITORING', 'IDENTITY_COMPROMISED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ──────────────────────────────────────────────────────────
-- threat_events table
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threat_events (
  id              TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- What kind of event this is
  type            TEXT        NOT NULL,                     -- e.g. 'CREDENTIAL_BREACH', 'IDENTITY_PING', 'DLP_HIT'

  -- Severity band (drives UI colour and alert routing)
  severity        threat_severity NOT NULL DEFAULT 'LOW',

  -- Identity context
  user_id         TEXT,                                     -- internal user / tenant identifier (nullable for anonymous hits)
  email           TEXT,                                     -- redacted if PII controls require

  -- Network context
  source_ip       TEXT,                                     -- source IP of the offending request / feed entry
  country         TEXT,                                     -- ISO 3166-1 alpha-2 country code (e.g. 'CN', 'RU', 'US')

  -- Threat detail
  status          threat_status NOT NULL DEFAULT 'MONITORING',
  breach_source   TEXT,                                     -- name of the breach database where credential was found
  exposed_fields  TEXT[],                                   -- e.g. ARRAY['email','password_hash','SSN_partial']
  risk_score      INTEGER     NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  payload_hash    TEXT        NOT NULL,                     -- SHA-256 of the raw feed payload (deduplication key)
  latency_ms      INTEGER,                                  -- time taken by the dark-web feed check in ms

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────
-- Indexes
-- ──────────────────────────────────────────────────────────

-- Fast reverse-chronological feed queries (primary UI query)
CREATE INDEX IF NOT EXISTS idx_threat_events_created_at
  ON threat_events (created_at DESC);

-- Filter by severity for alert panels
CREATE INDEX IF NOT EXISTS idx_threat_events_severity
  ON threat_events (severity);

-- Filter by status for the "compromised" panel
CREATE INDEX IF NOT EXISTS idx_threat_events_status
  ON threat_events (status);

-- Deduplication lookup (payload_hash must be unique per day)
CREATE UNIQUE INDEX IF NOT EXISTS idx_threat_events_payload_hash_day
  ON threat_events (payload_hash, DATE_TRUNC('day', created_at));

-- ──────────────────────────────────────────────────────────
-- Row-level comment
-- ──────────────────────────────────────────────────────────
COMMENT ON TABLE threat_events IS
  'Identity Threat Intelligence events. Written by the threat-intel pipeline '
  'and the dark-web credential breach scanner. Read by /api/intel/feed.';

COMMIT;
