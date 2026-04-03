#!/usr/bin/env bash
# =============================================================================
# backup.sh — StreetMP OS PostgreSQL Backup Script
# Phase1-INFRA-02: Automated pg_dump + gzip with retention management
# =============================================================================
#
# USAGE:
#   ./backup.sh [OPTIONS]
#
# OPTIONS:
#   --db-name NAME    Database name      (env: DB_NAME,    default: streetmp_os)
#   --db-user USER    Database user      (env: DB_USER,    default: streetmp)
#   --db-host HOST    Database host      (env: DB_HOST,    default: localhost)
#   --db-port PORT    Database port      (env: DB_PORT,    default: 5432)
#   --backup-dir DIR  Backup directory   (env: BACKUP_DIR, default: /var/backups/streetmp)
#   --retain DAYS     Retention in days  (env: RETAIN_DAYS,default: 14)
#   --slack-url URL   Slack webhook URL  (env: SLACK_WEBHOOK_URL, optional)
#   --help            Show this help
#
# ENVIRONMENT VARIABLES:
#   DB_NAME          — Postgres database name
#   DB_USER          — Postgres user
#   DB_HOST          — Postgres host
#   DB_PORT          — Postgres port
#   DB_PASS          — Postgres password (set PGPASSWORD)
#   BACKUP_DIR       — Output directory for .sql.gz files
#   RETAIN_DAYS      — Days to keep backups (older files are deleted)
#   SLACK_WEBHOOK_URL — Optional Slack incoming webhook for alerts
#
# OUTPUT FILE FORMAT:
#   streetmp_os_YYYYMMDD_HHMMSS_UTC.sql.gz
#   e.g. streetmp_os_20260401_030000_UTC.sql.gz
#
# EXIT CODES:
#   0 — Success
#   1 — pg_dump failure
#   2 — Compression failure
#   3 — Retention cleanup failure (backup still succeeded)
#
# CRONTAB SETUP (daily at 03:00 UTC):
# ─────────────────────────────────────────────────────────────────
#   Open the crontab editor:
#     crontab -e    (for current user)
#     sudo crontab -e -u postgres   (for the postgres user)
#
#   Add this line for daily backups at 03:00 UTC:
#     0 3 * * * /opt/streetmp/scripts/backup.sh >> /var/log/streetmp-backup.log 2>&1
#
#   Or with full env sourcing (recommended for production):
#     0 3 * * * /bin/bash -c 'source /opt/streetmp/.env && /opt/streetmp/scripts/backup.sh' >> /var/log/streetmp-backup.log 2>&1
#
#   To verify the crontab was saved:
#     crontab -l
#
#   Monitoring: check /var/log/streetmp-backup.log for status lines like:
#     [BACKUP] ✅ SUCCESS: /var/backups/streetmp/streetmp_os_20260401_030000_UTC.sql.gz (12.4 MB)
# ─────────────────────────────────────────────────────────────────
#
# =============================================================================

set -euo pipefail

# ── ANSI colours ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[BACKUP]${NC} $*"; }
ok()  { echo -e "${GREEN}[BACKUP] ✅${NC} $*"; }
warn(){ echo -e "${YELLOW}[BACKUP] ⚠️${NC} $*"; }
err() { echo -e "${RED}[BACKUP] ❌${NC} $*" >&2; }

# ── Defaults (overrideable via env or CLI flags) ──────────────────
DB_NAME="${DB_NAME:-streetmp_os}"
DB_USER="${DB_USER:-streetmp}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/streetmp}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# ── Argument parsing ──────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-name)   DB_NAME="$2";   shift 2 ;;
    --db-user)   DB_USER="$2";   shift 2 ;;
    --db-host)   DB_HOST="$2";   shift 2 ;;
    --db-port)   DB_PORT="$2";   shift 2 ;;
    --backup-dir)BACKUP_DIR="$2";shift 2 ;;
    --retain)    RETAIN_DAYS="$2";shift 2 ;;
    --slack-url) SLACK_WEBHOOK_URL="$2"; shift 2 ;;
    --help)
      head -60 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      err "Unknown argument: $1 (use --help for usage)"
      exit 1
      ;;
  esac
done

# ── Export PGPASSWORD so pg_dump doesn't prompt ───────────────────
if [[ -n "${DB_PASS:-}" ]]; then
  export PGPASSWORD="${DB_PASS}"
fi

# ── Validate pg_dump is available ────────────────────────────────
if ! command -v pg_dump &>/dev/null; then
  err "pg_dump not found in PATH. Install postgresql-client."
  exit 1
fi

# ── Create backup directory ───────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

# ── Generate timestamp & filename ────────────────────────────────
TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')_UTC"
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
FILEPATH_TMP="${FILEPATH}.tmp"

log "========================================================="
log "StreetMP OS — PostgreSQL Backup"
log "  Database : ${DB_NAME}@${DB_HOST}:${DB_PORT} (user: ${DB_USER})"
log "  Output   : ${FILEPATH}"
log "  Retention: ${RETAIN_DAYS} days"
log "  Started  : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
log "========================================================="

# ── Run pg_dump and pipe directly to gzip ────────────────────────
START_EPOCH="$(date -u '+%s')"

if ! pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  "${DB_NAME}" \
  | gzip --best > "${FILEPATH_TMP}"; then
  err "pg_dump failed for database '${DB_NAME}'"
  rm -f "${FILEPATH_TMP}"
  _notify_slack "❌ *StreetMP Backup FAILED* — \`pg_dump\` error for \`${DB_NAME}\` on \`${DB_HOST}\`" "danger"
  exit 1
fi

# ── Validate the output file is non-empty ────────────────────────
FILESIZE="$(du -sh "${FILEPATH_TMP}" | cut -f1)"
if [[ ! -s "${FILEPATH_TMP}" ]]; then
  err "Backup produced an empty file — aborting"
  rm -f "${FILEPATH_TMP}"
  _notify_slack "❌ *StreetMP Backup FAILED* — output file was empty for \`${DB_NAME}\`" "danger"
  exit 2
fi

# ── Atomically rename the temp file ──────────────────────────────
mv "${FILEPATH_TMP}" "${FILEPATH}"
chmod 600 "${FILEPATH}"   # Owner-read-only (backup may contain PII)

END_EPOCH="$(date -u '+%s')"
DURATION=$((END_EPOCH - START_EPOCH))

ok "SUCCESS: ${FILEPATH} (${FILESIZE}) in ${DURATION}s"

# ── Verify gzip integrity ─────────────────────────────────────────
if gzip --test "${FILEPATH}" 2>/dev/null; then
  ok "Gzip integrity check passed"
else
  warn "Gzip integrity check FAILED — backup may be corrupt. Keeping file for inspection."
fi

# ── Retention cleanup ─────────────────────────────────────────────
log "Running retention cleanup (removing backups older than ${RETAIN_DAYS} days)..."

REMOVED=0
while IFS= read -r -d '' old_file; do
  rm -f "${old_file}"
  warn "Removed old backup: ${old_file}"
  REMOVED=$((REMOVED + 1))
done < <(find "${BACKUP_DIR}" -name "*.sql.gz" -mtime "+${RETAIN_DAYS}" -print0)

if [[ "${REMOVED}" -gt 0 ]]; then
  ok "Retention cleanup: removed ${REMOVED} file(s) older than ${RETAIN_DAYS} days"
else
  log "Retention cleanup: no files older than ${RETAIN_DAYS} days found"
fi

# ── List current backups ──────────────────────────────────────────
log "Current backups in ${BACKUP_DIR}:"
find "${BACKUP_DIR}" -name "*.sql.gz" -printf "  %f\t%kK\n" 2>/dev/null | sort || true

# ── Slack notification helper ─────────────────────────────────────
_notify_slack() {
  local message="$1"
  local color="${2:-good}"
  if [[ -n "${SLACK_WEBHOOK_URL}" ]]; then
    curl -s -X POST "${SLACK_WEBHOOK_URL}" \
      -H 'Content-type: application/json' \
      --data "{\"attachments\": [{\"color\": \"${color}\", \"text\": \"${message}\"}]}" \
      --max-time 10 &>/dev/null || true
  fi
}

_notify_slack \
  "✅ *StreetMP Backup OK* — \`${FILENAME}\` (${FILESIZE}) completed in ${DURATION}s on \`$(hostname)\`" \
  "good"

log "========================================================="
log "Backup complete: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
log "========================================================="

exit 0
