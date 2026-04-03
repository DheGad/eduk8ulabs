#!/usr/bin/env bash
# ============================================================
# StreetMP Sovereign OS — Nitro Enclave Build Script (GL-01)
#
# Produces:          streetmp-v8.eif
# Required tools:    docker, nitro-cli
# Target EC2 type:   c6a.xlarge  (or any Nitro-enabled instance)
#
# Usage:
#   ./build-enclave.sh              # Full build + EIF packaging
#   ./build-enclave.sh --no-nitro   # Docker build only (CI/local dev)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_TAG="streetmp-enclave:latest"
EIF_OUTPUT="streetmp-v8.eif"
CONTEXT_DIR="${SCRIPT_DIR}/nitro-tokenizer"
DOCKERFILE="${CONTEXT_DIR}/Dockerfile.enclave"

# ── Argument Parsing ─────────────────────────────────────────
BUILD_NITRO=true
for arg in "$@"; do
  case "$arg" in
    --no-nitro) BUILD_NITRO=false ;;
    *) echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Step 1: Docker Multi-Stage Build ─────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  [1/2] Building Enclave Docker Image"
echo "  Tag:        ${DOCKER_TAG}"
echo "  Context:    ${CONTEXT_DIR}"
echo "  Dockerfile: ${DOCKERFILE}"
echo "═══════════════════════════════════════════════════════"
echo ""

docker build \
  --platform linux/amd64 \
  --no-cache \
  -t "${DOCKER_TAG}" \
  -f "${DOCKERFILE}" \
  "${CONTEXT_DIR}"

echo ""
echo "  ✅ Docker image built: ${DOCKER_TAG}"
echo ""

# ── Step 2: Nitro-CLI EIF Packaging ──────────────────────────
if [ "${BUILD_NITRO}" = "true" ]; then
  echo "═══════════════════════════════════════════════════════"
  echo "  [2/2] Packaging Nitro Enclave Image"
  echo "  Source:  ${DOCKER_TAG}"
  echo "  Output:  ${SCRIPT_DIR}/${EIF_OUTPUT}"
  echo "═══════════════════════════════════════════════════════"
  echo ""

  nitro-cli build-enclave \
    --docker-uri "${DOCKER_TAG}" \
    --output-file "${SCRIPT_DIR}/${EIF_OUTPUT}"

  echo ""
  echo "  ✅ Enclave image written: ${SCRIPT_DIR}/${EIF_OUTPUT}"
  echo ""
  echo "  ───────────────────────────────────────────────────"
  echo "  PCR Hashes for Auditor Attestation:"
  nitro-cli describe-enclaves 2>/dev/null || \
    echo "  (Run on EC2 Nitro host to get live PCR values)"
  echo "  ───────────────────────────────────────────────────"
else
  echo "  ⚠  --no-nitro flag set. EIF packaging skipped."
fi

echo ""
echo "  Build complete. Deploy with: ./run-enclave.sh"
echo ""
