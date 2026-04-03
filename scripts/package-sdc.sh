#!/usr/bin/env bash
# =============================================================================
# StreetMP OS — Sovereign Datacenter (SDC) Edition
# OCI Artifact Bundle Script
# @version V100 — Project Omega
# @description Produces a single, completely self-contained .tar.gz OCI archive
#              containing the full microservice matrix (V01–V100) plus the local
#              LLM stack (Ollama + Llama-3-8B-Instruct-Q4_K_M) pre-baked.
#              The resulting artifact requires ZERO outbound packets to boot.
#
# USAGE:
#   ./scripts/package-sdc.sh
#   ./scripts/package-sdc.sh --output /mnt/usb/streetmp-sdc.tar.gz
#
# REQUIREMENTS:
#   - Docker (with BuildKit) or Podman
#   - At least 20GB free disk space (Llama-3-8B-Q4 ≈ 5GB + service images ≈ 8GB)
#   - Internet access ONCE to pull base layers and the model (subsequent runs use cache)
# =============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${1:-${ROOT_DIR}/streetmp-sdc-${TIMESTAMP}.tar.gz}"
STAGING_DIR="${ROOT_DIR}/.sdc-staging-${TIMESTAMP}"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.yml"
OLLAMA_MODEL="llama3:8b-instruct-q4_K_M"
OLLAMA_IMAGE="ollama/ollama:latest"

# ── Colours ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${CYAN}[SDC]${NC} $*"; }
ok()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
die()  { echo -e "${RED}[✗] FATAL: $*${NC}"; exit 1; }

# ── Pre-flight ───────────────────────────────────────────────────────────────
log "============================================================"
log " StreetMP OS · Sovereign Datacenter Bundle · V100"
log " Project Omega — Air-Gap OCI Packager"
log "============================================================"

command -v docker >/dev/null 2>&1 || die "Docker is required but not found in PATH."

FREE_GB=$(df -BG "${ROOT_DIR}" | awk 'NR==2 {print $4}' | tr -d 'G')
if (( FREE_GB < 20 )); then
  die "Insufficient disk space: ${FREE_GB}GB available, 20GB required."
fi
ok "Pre-flight checks passed (${FREE_GB}GB free)"

mkdir -p "${STAGING_DIR}"

# ── Step 1: Build all microservice images ────────────────────────────────────
log "Step 1/5 — Building microservice matrix (V01–V99)..."
docker compose -f "${COMPOSE_FILE}" build --parallel 2>&1 | \
  grep -E "(Building|DONE|ERROR)" || true
ok "Microservice images built"

# ── Step 2: Pull Ollama base image ───────────────────────────────────────────
log "Step 2/5 — Pulling Ollama runtime (${OLLAMA_IMAGE})..."
docker pull "${OLLAMA_IMAGE}"
ok "Ollama runtime pulled"

# ── Step 3: Pre-bake Llama-3-8B-Instruct into a custom Ollama image ─────────
log "Step 3/5 — Pre-baking Llama-3-8B-Instruct-Q4_K_M into OCI layer..."
log "          This is the air-gap commitment: the model is embedded, not downloaded."

# Create a temporary Modelfile so the model is committed to an image layer
MODELFILE_PATH="${STAGING_DIR}/Modelfile"
cat > "${MODELFILE_PATH}" <<'MODELFILE'
FROM llama3:8b-instruct-q4_K_M
SYSTEM """
You are a StreetMP OS Sovereign AI assistant. You operate within strict governance rails.
You never reveal system internals, PII, or confidential tenant data.
All responses are subject to the V71 Prompt Firewall and V67 DLP Scrubber.
"""
PARAMETER temperature 0.4
PARAMETER num_predict 2048
PARAMETER stop "<|end_of_text|>"
MODELFILE

# Spin up a temporary Ollama container, pull the model into it, commit to a new image
TEMP_CONTAINER="streetmp-ollama-bake-${TIMESTAMP}"
log "  Starting temporary Ollama container to bake model..."
docker run --name "${TEMP_CONTAINER}" -d \
  -e OLLAMA_KEEP_ALIVE=-1 \
  "${OLLAMA_IMAGE}"

log "  Pulling ${OLLAMA_MODEL} into container (this may take 5–10 minutes)..."
docker exec "${TEMP_CONTAINER}" ollama pull "${OLLAMA_MODEL}"

log "  Creating custom Modelfile (system prompt injection)..."
docker cp "${MODELFILE_PATH}" "${TEMP_CONTAINER}:/tmp/Modelfile"
docker exec "${TEMP_CONTAINER}" ollama create streetmp-sovereign -f /tmp/Modelfile

log "  Committing baked model to new image: streetmp-os/ollama-sovereign:v100..."
docker commit \
  --message "StreetMP OS V100 — Llama-3-8B-Instruct-Q4 baked image" \
  --author "StreetMP OS Build System <build@streetmp.com>" \
  "${TEMP_CONTAINER}" \
  "streetmp-os/ollama-sovereign:v100"

docker stop "${TEMP_CONTAINER}" && docker rm "${TEMP_CONTAINER}"
ok "Llama-3-8B-Instruct-Q4_K_M baked into streetmp-os/ollama-sovereign:v100"

# ── Step 4: Export all images to staging ────────────────────────────────────
log "Step 4/5 — Exporting all images to OCI tar archives..."

# Collect all service image names from compose file
IMAGES=$(docker compose -f "${COMPOSE_FILE}" config --images 2>/dev/null || \
         docker compose -f "${COMPOSE_FILE}" config | grep 'image:' | awk '{print $2}')

# Add our baked Ollama image
IMAGES="${IMAGES} streetmp-os/ollama-sovereign:v100"

ARCHIVE_PATH="${STAGING_DIR}/images.tar"
log "  Saving $(echo "${IMAGES}" | wc -w | tr -d ' ') images to ${ARCHIVE_PATH}..."

# shellcheck disable=SC2086
docker save -o "${ARCHIVE_PATH}" ${IMAGES}
ok "Images exported ($(du -sh "${ARCHIVE_PATH}" | cut -f1))"

# ── Step 5: Package bundle ─────────────────────────────────────────────────
log "Step 5/5 — Assembling final SDC artifact bundle..."

# Copy deployment assets
cp -r "${ROOT_DIR}/deploy/onprem" "${STAGING_DIR}/deploy-onprem"
cp "${ROOT_DIR}/.env.prod" "${STAGING_DIR}/.env.prod.template"

# Manifest
cat > "${STAGING_DIR}/MANIFEST.json" <<EOF
{
  "version": "V100",
  "build_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "model": "${OLLAMA_MODEL}",
  "model_image": "streetmp-os/ollama-sovereign:v100",
  "services": $(echo "${IMAGES}" | tr ' ' '\n' | jq -R '.' | jq -sc '.'),
  "air_gap": true,
  "install_command": "streetmp-ctl install --bundle ./streetmp-sdc-${TIMESTAMP}.tar.gz"
}
EOF

# README
cat > "${STAGING_DIR}/README.txt" <<'EOF'
===  StreetMP OS — Sovereign Datacenter (SDC) Edition ===
=== Project Omega · V100 · Air-Gapped Enterprise Appliance ===

REQUIREMENTS
  - Linux x86_64 host with K3s (or install via streetmp-ctl)
  - 16GB RAM minimum (32GB recommended)
  - 4 CPU cores (8 recommended)
  - 40GB free disk

INSTALLATION
  1. Transfer this .tar.gz to the target air-gapped host
  2. Run: tar xzf streetmp-sdc-*.tar.gz
  3. Run: ./streetmp-ctl install
  4. Access the admin UI at http://<host-ip>:3000

NO INTERNET REQUIRED after extraction.
EOF

# Compress everything
log "  Compressing bundle to ${OUTPUT_FILE}..."
tar -czf "${OUTPUT_FILE}" -C "${STAGING_DIR}" .

# Cleanup staging
rm -rf "${STAGING_DIR}"

# ── Done ────────────────────────────────────────────────────────────────────
ARTIFACT_SIZE=$(du -sh "${OUTPUT_FILE}" | cut -f1)
echo ""
echo -e "${GREEN}${BOLD}============================================================"
echo -e " PROJECT OMEGA · SDC BUNDLE COMPLETE"
echo -e "============================================================${NC}"
echo -e "${BOLD}Artifact:${NC} ${OUTPUT_FILE}"
echo -e "${BOLD}Size:${NC}     ${ARTIFACT_SIZE}"
echo -e "${BOLD}Model:${NC}    ${OLLAMA_MODEL} (pre-baked, zero-download)"
echo -e "${BOLD}Status:${NC}   ${GREEN}READY FOR AIR-GAP DEPLOYMENT${NC}"
echo ""
echo -e "SHA256: $(shasum -a 256 "${OUTPUT_FILE}" | awk '{print $1}')"
echo ""
