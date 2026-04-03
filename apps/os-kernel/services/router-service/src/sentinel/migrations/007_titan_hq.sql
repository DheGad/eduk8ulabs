-- =============================================================================
-- PHASE 7: TITAN 3.0 SOVEREIGN SIDECAR
-- @migration 007_titan_hq
-- @description
--   Standalone HQ tracking schema and Impersonation logging.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staff_hq;

CREATE TABLE IF NOT EXISTS staff_hq.internal_staff (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        UNIQUE NOT NULL, -- references public.users(id) but kept agnostic
  username       TEXT        UNIQUE NOT NULL,
  admin_role     TEXT        NOT NULL DEFAULT 'SUPPORT', -- SUPER, FINANCE, SUPPORT
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_hq.hq_audit_log (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID        NOT NULL REFERENCES staff_hq.internal_staff(id),
  action         TEXT        NOT NULL,
  target_org_id  UUID,       -- nullable, if action targets a specific org
  target_user_id UUID,       -- nullable, if action is impersonation
  metadata       JSONB       DEFAULT '{}'::jsonb,
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
