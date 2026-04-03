-- ============================================================
-- Migration: execution_costs — add org_id column
-- Phase 6 Audit Remediation · 2026-04-03
-- Ticket: Sovereign Quality Report — Pillar 3 Schema Gap (P1)
-- ============================================================
-- Purpose:
--   The initial execution_costs schema tracked spend by user_id only.
--   For enterprise multi-user orgs this makes aggregate billing impossible.
--   This migration adds org_id so cost queries can be grouped by company.
--
-- Run with:
--   psql $DATABASE_URL -f 20260403_execution_costs_add_org_id.sql
-- ============================================================

BEGIN;

-- ── 1. Add org_id column (nullable for legacy rows) ─────────────────────────
ALTER TABLE execution_costs
  ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

-- ── 2. Back-fill org_id from the users table for existing rows ──────────────
-- This is safe because users.org_id is stable (set at account creation).
-- Rows without a linked user (anonymous calls) remain NULL.
UPDATE execution_costs ec
SET    org_id = u.org_id
FROM   users u
WHERE  ec.user_id = u.id
  AND  ec.org_id  IS NULL
  AND  u.org_id   IS NOT NULL;

-- ── 3. Index for fast per-org aggregation ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_execution_costs_org_id
    ON execution_costs (org_id)
    WHERE org_id IS NOT NULL;

-- ── 4. Composite index for monthly-cost-by-org queries ───────────────────────
-- Supports: WHERE org_id = $1 AND created_at >= date_trunc('month', NOW())
CREATE INDEX IF NOT EXISTS idx_execution_costs_org_month
    ON execution_costs (org_id, created_at DESC)
    WHERE org_id IS NOT NULL;

COMMENT ON COLUMN execution_costs.org_id IS
    'Tenant organization FK. Added in Phase 6 audit remediation. '
    'Enables billing aggregation by company rather than individual user. '
    'Back-filled from users.org_id for pre-migration rows.';

COMMIT;
