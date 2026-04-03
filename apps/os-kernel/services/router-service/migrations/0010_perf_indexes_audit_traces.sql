-- =============================================================================
-- Migration: 0010_perf_indexes_audit_traces.sql
-- Description: B-Tree performance indexes on audit_logs and traces tables.
--              CEO Report and analytics queries filter primarily by tenant_id
--              and timestamp — without these indexes both queries become
--              sequential scans and will time out for large tenants (>100k rows).
--
-- Execution: idempotent (CREATE INDEX IF NOT EXISTS)
-- Safe to run on live DB (CONCURRENTLY — no table lock, zero downtime)
-- =============================================================================

-- ─── audit_logs indexes ──────────────────────────────────────────────────────

-- Primary filter: per-tenant log lookup (CEO audit report, analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_id
  ON audit_logs (tenant_id);

-- Time-range filter: "Last 30 Days" report window
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp
  ON audit_logs (timestamp DESC);

-- Composite: most efficient for the pattern WHERE tenant_id = $1 AND timestamp >= $2
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_timestamp
  ON audit_logs (tenant_id, timestamp DESC);

-- DLP query: count PII infractions per tenant (pii_blocked flag or dlp_triggered)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant_dlp
  ON audit_logs (tenant_id, dlp_triggered)
  WHERE dlp_triggered = TRUE;

-- ─── traces indexes ───────────────────────────────────────────────────────────

-- Primary filter: per-tenant trace lookup (V70 trace explorer)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_tenant_id
  ON traces (tenant_id);

-- Time-range filter: recent traces panel
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_timestamp
  ON traces (timestamp DESC);

-- Composite: trace_id + tenant isolation (prevent cross-tenant trace leakage)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_tenant_trace_id
  ON traces (tenant_id, trace_id);

-- Status filter: count active / failed traces per tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_traces_tenant_status
  ON traces (tenant_id, status);

-- ─── merkle_logs indexes (Merkle snapshot persistence) ───────────────────────

-- Snapshot lookup: importSnapshot() queries by (tenant_id, date)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_merkle_logs_tenant_date
  ON merkle_logs (tenant_id, date DESC);

-- ─── api_keys indexes ─────────────────────────────────────────────────────────

-- Key hash lookup: validateKey() — the hot path for every API request
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_key_hash
  ON api_keys (key_hash);

-- Tenant filter: "List my keys" query in the dashboard
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_tenant_id
  ON api_keys (tenant_id);

-- ─── team_invites indexes (Phase 4 — Team Engine) ────────────────────────────

-- Email lookup: resend / accept flow
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_invites_email
  ON team_invites (email);

-- Tenant filter: list pending invites per tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_invites_tenant_id
  ON team_invites (tenant_id, status);

-- Token lookup: accept-invite endpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_invites_token
  ON team_invites (token)
  WHERE status = 'pending';
