#!/usr/bin/env bash
# ============================================================
# StreetMP Sovereign OS — Nitro Enclave Run Script (GL-01)
#
# Runs the pre-built streetmp-v8.eif on an EC2 Nitro host.
# This script is STATELESS — no volume mounts or disk writes.
#
# Usage:
#   ./run-enclave.sh               # Production mode (debug OFF)
#   ./run-enclave.sh --debug       # Debug mode (console visible)
#   ./run-enclave.sh --stop        # Terminate any running enclave
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EIF_PATH="${SCRIPT_DIR}/streetmp-v8.eif"

# ── Configuration ─────────────────────────────────────────────
CPU_COUNT=2
MEMORY_MIB=1024
ENCLAVE_CID=16        # Must match ENCLAVE_CID env var in Control Plane

# ── Argument Parsing ─────────────────────────────────────────
DEBUG_MODE=false
STOP_MODE=false

for arg in "$@"; do
  case "$arg" in
    --debug) DEBUG_MODE=true ;;
    --stop)  STOP_MODE=true ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Terminate Existing Enclave ────────────────────────────────
if [ "${STOP_MODE}" = "true" ]; then
  echo ""
  echo "  Stopping all running StreetMP enclaves..."
  ENCLAVE_IDS=$(nitro-cli describe-enclaves | python3 -c \
    "import sys,json; [print(e['EnclaveID']) for e in json.load(sys.stdin)]" 2>/dev/null || true)
  if [ -n "${ENCLAVE_IDS}" ]; then
    echo "${ENCLAVE_IDS}" | xargs -I{} nitro-cli terminate-enclave --enclave-id {}
    echo "  ✅ All enclaves terminated."
  else
    echo "  ℹ  No running enclaves found."
  fi
  exit 0
fi

# ── Pre-flight Checks ──────────────────────────────────────────
if [ ! -f "${EIF_PATH}" ]; then
  echo "  ❌ ERROR: EIF not found at ${EIF_PATH}"
  echo "     Run ./build-enclave.sh first."
  exit 1
fi

# ── Launch Enclave ─────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  StreetMP Sovereign OS — Nitro Enclave Launcher"
echo "  EIF:        ${EIF_PATH}"
echo "  CPUs:       ${CPU_COUNT}"
echo "  Memory:     ${MEMORY_MIB} MiB"
echo "  vSock CID:  ${ENCLAVE_CID}"
echo "  Debug Mode: ${DEBUG_MODE}"
echo "═══════════════════════════════════════════════════════"
echo ""

# Build the nitro-cli run command.
# Debug mode exposes the enclave's stdout/stderr to the host console.
# NEVER use --debug-mode in true production — it widens the attestation surface.
NITRO_CMD=(
  nitro-cli run-enclave
  --cpu-count   "${CPU_COUNT}"
  --memory      "${MEMORY_MIB}"
  --enclave-cid "${ENCLAVE_CID}"
  --eif-path    "${EIF_PATH}"
)

if [ "${DEBUG_MODE}" = "true" ]; then
  echo "  ⚠  WARNING: Debug mode is active. Console output IS visible to the host."
  echo "     DO NOT use this in production — it degrades the trust boundary."
  echo ""
  NITRO_CMD+=(--debug-mode)
fi

"${NITRO_CMD[@]}"

echo ""
echo "  ✅ Enclave launched successfully."
echo "     CID ${ENCLAVE_CID} is ready to accept vsock connections on port 5000."
echo ""
echo "  To view status: nitro-cli describe-enclaves"
echo "  To stop:        ./run-enclave.sh --stop"
echo ""
