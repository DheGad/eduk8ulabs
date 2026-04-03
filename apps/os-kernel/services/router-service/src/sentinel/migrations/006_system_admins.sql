-- =============================================================================
-- PHASE 6: TITAN SUPERADMIN COMMAND CENTER
-- @migration 006_system_admins
-- @description
--   Creates the system_admins table for the GOD_MODE control plane.
--   Isolated from standard users.
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_admins (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT        UNIQUE NOT NULL,
  email          TEXT        UNIQUE,
  password_hash  TEXT        NOT NULL,
  role           TEXT        NOT NULL DEFAULT 'GOD_MODE',
  last_login     TIMESTAMPTZ,
  requires_reset BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: user inserts are handled via the bootstrapTitan.ts utility.
-- Only 'admin_titan' is permitted at bootstrap.
