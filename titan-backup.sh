#!/usr/bin/env bash
# =============================================================================
# titan-backup.sh — Phase 6: Titan Hardening
# StreetMP OS — Automated Disaster Recovery Backup
# =============================================================================
#
# WHAT THIS DOES:
#   1. Dumps the PostgreSQL database (pg_dump, compressed)
#   2. Snaps Redis state (BGSAVE + RDB file) 
#   3. Archives NeMo Guardrails config files
#   4. Encrypts all archives with AES-256-CBC (OpenSSL, password from env)
#   5. Uploads the encrypted bundle to an S3 bucket via AWS CLI
#   6. Prunes local backup dir (keeps last 3 days) and S3 (keeps last 30 days)
#   7. Sends a Slack/webhook notification on success or failure
#
# SCHEDULING (cron — run as root or deploy user):
#   0 2 * * * /opt/streetmp/titan-backup.sh >> /var/log/titan-backup.log 2>&1
#
# REQUIRED ENV VARS (add to /etc/environment or systemd unit):
#   BACKUP_DB_HOST      — PostgreSQL host
#   BACKUP_DB_PORT      — PostgreSQL port (default: 5432)
#   BACKUP_DB_USER      — PostgreSQL user
#   BACKUP_DB_NAME      — Database name
#   BACKUP_DB_PASSWORD  — PostgreSQL password (used via PGPASSWORD)
#   BACKUP_REDIS_HOST   — Redis host (default: 127.0.0.1)
#   BACKUP_REDIS_PORT   — Redis port (default: 6379)
#   BACKUP_REDIS_AUTH   — Redis AUTH password (optional)
#   BACKUP_ENCRYPT_KEY  — Passphrase for AES-256 encryption (min 32 chars)
#   BACKUP_S3_BUCKET    — S3 bucket name (e.g. streetmp-backups-prod)
#   BACKUP_S3_PREFIX    — S3 key prefix (e.g. titan/prod)
#   BACKUP_S3_REGION    — AWS region (e.g. ap-southeast-1)
#   AWS_ACCESS_KEY_ID   — AWS credentials
#   AWS_SECRET_ACCESS_KEY
#   BACKUP_NOTIFY_URL   — Webhook URL for alerts (Slack, Discord, PagerDuty)
#   NEMO_CONFIG_DIR     — Path to NeMo config files (default: ./apps/nemo-guard)
#   BACKUP_LOCAL_DIR    — Local staging directory (default: /tmp/streetmp-backups)
# =============================================================================

set -euo pipefail

# ── Load .env if present (for manual runs) ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
  # shellcheck source=/dev/null
  set -o allexport
  source "${SCRIPT_DIR}/.env"
  set +o allexport
fi

# ── Defaults ──────────────────────────────────────────────────────────────────
BACKUP_DB_HOST="${BACKUP_DB_HOST:-127.0.0.1}"
BACKUP_DB_PORT="${BACKUP_DB_PORT:-5432}"
BACKUP_REDIS_HOST="${BACKUP_REDIS_HOST:-127.0.0.1}"
BACKUP_REDIS_PORT="${BACKUP_REDIS_PORT:-6379}"
NEMO_CONFIG_DIR="${NEMO_CONFIG_DIR:-${SCRIPT_DIR}/apps/nemo-guard}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-/tmp/streetmp-backups}"
BACKUP_S3_REGION="${BACKUP_S3_REGION:-ap-southeast-1}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-titan/prod}"
LOCAL_RETAIN_DAYS=3
S3_RETAIN_DAYS=30

# ── Validate required vars ────────────────────────────────────────────────────
REQUIRED_VARS=(
  BACKUP_DB_USER BACKUP_DB_NAME BACKUP_DB_PASSWORD
  BACKUP_ENCRYPT_KEY BACKUP_S3_BUCKET
  AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "[TITAN-BACKUP] ❌ FATAL: Required env var '$var' is not set." >&2
    exit 1
  fi
done

# Enforce minimum key length for encryption safety
if [[ "${#BACKUP_ENCRYPT_KEY}" -lt 32 ]]; then
  echo "[TITAN-BACKUP] ❌ FATAL: BACKUP_ENCRYPT_KEY must be at least 32 characters." >&2
  exit 1
fi

# ── Timestamp and paths ───────────────────────────────────────────────────────
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S_UTC)"
BACKUP_STAGE="${BACKUP_LOCAL_DIR}/${TIMESTAMP}"
BUNDLE_NAME="titan-backup-${TIMESTAMP}.tar.gz.enc"
BUNDLE_PATH="${BACKUP_LOCAL_DIR}/${BUNDLE_NAME}"

mkdir -p "${BACKUP_STAGE}"

# ── Logging helpers ───────────────────────────────────────────────────────────
log()  { echo "[TITAN-BACKUP] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }
fail() { log "❌ FATAL: $*"; notify_failure "$*"; exit 1; }

# ── Notification helper ───────────────────────────────────────────────────────
notify_success() {
  [[ -z "${BACKUP_NOTIFY_URL:-}" ]] && return
  curl -sf -X POST "${BACKUP_NOTIFY_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"✅ [StreetMP Titan Backup] SUCCESS — \`${BUNDLE_NAME}\` uploaded to s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/ at ${TIMESTAMP}\"}" \
    > /dev/null 2>&1 || true
}

notify_failure() {
  [[ -z "${BACKUP_NOTIFY_URL:-}" ]] && return
  curl -sf -X POST "${BACKUP_NOTIFY_URL}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"🚨 [StreetMP Titan Backup] FAILED — ${1:-Unknown error} at ${TIMESTAMP}. Immediate action required!\"}" \
    > /dev/null 2>&1 || true
}

# ── Trap: cleanup staging on any error ───────────────────────────────────────
cleanup() {
  log "Cleaning up staging dir..."
  rm -rf "${BACKUP_STAGE}"
}
trap cleanup EXIT

log "════════════════════════════════════════════════════"
log "  Titan Backup — Phase 6 DR — ${TIMESTAMP}"
log "════════════════════════════════════════════════════"

# ── STEP 1: PostgreSQL dump ───────────────────────────────────────────────────
log "[1/5] Dumping PostgreSQL database '${BACKUP_DB_NAME}'..."
PG_DUMP_FILE="${BACKUP_STAGE}/postgres_${BACKUP_DB_NAME}.sql.gz"

PGPASSWORD="${BACKUP_DB_PASSWORD}" pg_dump \
  --host="${BACKUP_DB_HOST}" \
  --port="${BACKUP_DB_PORT}" \
  --username="${BACKUP_DB_USER}" \
  --dbname="${BACKUP_DB_NAME}" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip -9 > "${PG_DUMP_FILE}" \
  || fail "pg_dump failed. Check DB connectivity."

PG_SIZE="$(du -sh "${PG_DUMP_FILE}" | cut -f1)"
log "    ✓ PostgreSQL dump: ${PG_DUMP_FILE} (${PG_SIZE})"

# ── STEP 2: Redis RDB snapshot ────────────────────────────────────────────────
log "[2/5] Snapshotting Redis state..."
REDIS_DUMP_FILE="${BACKUP_STAGE}/redis_dump.rdb.gz"

# Issue BGSAVE and wait for completion (max 60 seconds)
if [[ -n "${BACKUP_REDIS_AUTH:-}" ]]; then
  REDIS_CMD="redis-cli -h ${BACKUP_REDIS_HOST} -p ${BACKUP_REDIS_PORT} -a ${BACKUP_REDIS_AUTH}"
else
  REDIS_CMD="redis-cli -h ${BACKUP_REDIS_HOST} -p ${BACKUP_REDIS_PORT}"
fi

# Trigger background save
BGSAVE_RESULT="$(${REDIS_CMD} BGSAVE 2>/dev/null || echo "ERR")"
if [[ "${BGSAVE_RESULT}" == *"ERR"* ]]; then
  log "    ⚠️  Redis BGSAVE failed — skipping Redis backup (non-fatal)"
else
  # Wait for BGSAVE to complete
  MAX_WAIT=60
  WAITED=0
  while [[ "${WAITED}" -lt "${MAX_WAIT}" ]]; do
    LASTSAVE_BGSAVE="$(${REDIS_CMD} LASTSAVE 2>/dev/null || echo "0")"
    BGSAVE_STATUS="$(${REDIS_CMD} INFO persistence 2>/dev/null | grep rdb_bgsave_in_progress | tr -d '\r' | cut -d: -f2)"
    if [[ "${BGSAVE_STATUS}" == "0" ]]; then break; fi
    sleep 2
    WAITED=$((WAITED + 2))
  done

  # Get RDB file location from Redis config
  REDIS_RDB_DIR="$(${REDIS_CMD} CONFIG GET dir 2>/dev/null | tail -1 || echo "/var/lib/redis")"
  REDIS_RDB_NAME="$(${REDIS_CMD} CONFIG GET dbfilename 2>/dev/null | tail -1 || echo "dump.rdb")"
  REDIS_RDB_PATH="${REDIS_RDB_DIR}/${REDIS_RDB_NAME}"

  if [[ -f "${REDIS_RDB_PATH}" ]]; then
    gzip -9 -c "${REDIS_RDB_PATH}" > "${REDIS_DUMP_FILE}"
    REDIS_SIZE="$(du -sh "${REDIS_DUMP_FILE}" | cut -f1)"
    log "    ✓ Redis snapshot: ${REDIS_DUMP_FILE} (${REDIS_SIZE})"
  else
    log "    ⚠️  RDB file not found at ${REDIS_RDB_PATH} — creating empty placeholder"
    echo "# Redis RDB not accessible" | gzip -9 > "${REDIS_DUMP_FILE}"
  fi
fi

# ── STEP 3: NeMo Guardrails config archive ────────────────────────────────────
log "[3/5] Archiving NeMo Guardrails configs..."
NEMO_ARCHIVE="${BACKUP_STAGE}/nemo_config.tar.gz"

if [[ -d "${NEMO_CONFIG_DIR}" ]]; then
  tar -czf "${NEMO_ARCHIVE}" -C "$(dirname "${NEMO_CONFIG_DIR}")" \
    --exclude="*.pyc" \
    --exclude="__pycache__" \
    --exclude="*.egg-info" \
    --exclude=".venv" \
    --exclude="node_modules" \
    "$(basename "${NEMO_CONFIG_DIR}")" \
    || fail "NeMo config archive failed."
  NEMO_SIZE="$(du -sh "${NEMO_ARCHIVE}" | cut -f1)"
  log "    ✓ NeMo config archive: ${NEMO_ARCHIVE} (${NEMO_SIZE})"
else
  log "    ⚠️  NeMo config dir not found at '${NEMO_CONFIG_DIR}' — skipping."
fi

# ── STEP 4: Bundle + AES-256 Encrypt ─────────────────────────────────────────
log "[4/5] Bundling and encrypting backup..."
RAW_BUNDLE="${BACKUP_LOCAL_DIR}/titan-backup-${TIMESTAMP}.tar.gz"

tar -czf "${RAW_BUNDLE}" -C "${BACKUP_LOCAL_DIR}" "${TIMESTAMP}/" \
  || fail "Failed to create bundle archive."

# AES-256-CBC encryption using a salted PBKDF2-derived key
openssl enc -aes-256-cbc \
  -pbkdf2 -iter 310000 \
  -pass "env:BACKUP_ENCRYPT_KEY" \
  -in  "${RAW_BUNDLE}" \
  -out "${BUNDLE_PATH}" \
  || fail "Encryption failed."

rm -f "${RAW_BUNDLE}"

BUNDLE_SIZE="$(du -sh "${BUNDLE_PATH}" | cut -f1)"
BUNDLE_SHA256="$(sha256sum "${BUNDLE_PATH}" | cut -d' ' -f1)"
log "    ✓ Encrypted bundle: ${BUNDLE_PATH} (${BUNDLE_SIZE})"
log "    ✓ SHA-256: ${BUNDLE_SHA256}"

# Write manifest
cat > "${BACKUP_LOCAL_DIR}/MANIFEST_${TIMESTAMP}.txt" << MANIFEST
TITAN BACKUP MANIFEST
=====================
Timestamp : ${TIMESTAMP}
Bundle    : ${BUNDLE_NAME}
Size      : ${BUNDLE_SIZE}
SHA-256   : ${BUNDLE_SHA256}
DB Host   : ${BACKUP_DB_HOST}
DB Name   : ${BACKUP_DB_NAME}
Cipher    : AES-256-CBC / PBKDF2 / 310000 iterations
MANIFEST

# ── STEP 5: Upload to S3 ──────────────────────────────────────────────────────
log "[5/5] Uploading to S3 (s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/)..."

export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION="${BACKUP_S3_REGION}"

aws s3 cp "${BUNDLE_PATH}" \
  "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${BUNDLE_NAME}" \
  --storage-class STANDARD_IA \
  --metadata "sha256=${BUNDLE_SHA256},timestamp=${TIMESTAMP},service=streetmp-titan" \
  --sse AES256 \
  || fail "S3 upload failed."

# Upload manifest
aws s3 cp "${BACKUP_LOCAL_DIR}/MANIFEST_${TIMESTAMP}.txt" \
  "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/MANIFEST_${TIMESTAMP}.txt" \
  --sse AES256 \
  > /dev/null 2>&1 || true

log "    ✓ S3 upload complete."

# ── Local pruning (keep last LOCAL_RETAIN_DAYS) ───────────────────────────────
log "Pruning local backups older than ${LOCAL_RETAIN_DAYS} days..."
find "${BACKUP_LOCAL_DIR}" -maxdepth 1 \
  -name "titan-backup-*.enc" \
  -mtime "+${LOCAL_RETAIN_DAYS}" \
  -delete && \
find "${BACKUP_LOCAL_DIR}" -maxdepth 1 \
  -name "MANIFEST_*.txt" \
  -mtime "+${LOCAL_RETAIN_DAYS}" \
  -delete

# ── S3 lifecycle pruning (via CLI — bucket lifecycle policy is preferred) ─────
log "Pruning S3 backups older than ${S3_RETAIN_DAYS} days..."
CUTOFF="$(date -u -d "-${S3_RETAIN_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
        || date -u -v-${S3_RETAIN_DAYS}d +%Y-%m-%dT%H:%M:%SZ)"  # macOS fallback

aws s3api list-objects-v2 \
  --bucket "${BACKUP_S3_BUCKET}" \
  --prefix "${BACKUP_S3_PREFIX}/" \
  --query "Contents[?LastModified<='${CUTOFF}'].Key" \
  --output text 2>/dev/null \
| tr '\t' '\n' \
| grep "titan-backup-" \
| while read -r KEY; do
    [[ -z "${KEY}" ]] && continue
    aws s3 rm "s3://${BACKUP_S3_BUCKET}/${KEY}" > /dev/null 2>&1 && \
      log "  Pruned S3 object: ${KEY}"
  done

# ── Done ──────────────────────────────────────────────────────────────────────
log "════════════════════════════════════════════════════"
log "  ✅ Titan Backup COMPLETE — ${BUNDLE_NAME}"
log "     SHA-256: ${BUNDLE_SHA256}"
log "     S3: s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${BUNDLE_NAME}"
log "════════════════════════════════════════════════════"

notify_success

# ── DECRYPT INSTRUCTIONS (printed for ops reference) ─────────────────────────
cat << DECRYPT_HINT

  TO RESTORE THIS BACKUP:
  ─────────────────────────────────────────────────────────────────────
  # 1. Download from S3
  aws s3 cp s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${BUNDLE_NAME} .

  # 2. Decrypt (set BACKUP_ENCRYPT_KEY in env first)
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 310000 \\
    -pass env:BACKUP_ENCRYPT_KEY \\
    -in  ${BUNDLE_NAME} \\
    -out titan-restore.tar.gz

  # 3. Extract
  tar -xzf titan-restore.tar.gz

  # 4. Restore PostgreSQL
  zcat postgres_${BACKUP_DB_NAME}.sql.gz | psql -U \$BACKUP_DB_USER -d \$BACKUP_DB_NAME

  # 5. Restore Redis (copy RDB file to Redis data dir, restart Redis)
  zcat redis_dump.rdb.gz > /var/lib/redis/dump.rdb && systemctl restart redis
  ─────────────────────────────────────────────────────────────────────
DECRYPT_HINT
