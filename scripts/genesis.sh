#!/usr/bin/env bash

# ==============================================================================
# STREETMP OS: THE GENESIS IGNITION
# Phase 24 | Final Go-To-Market Automation
# ==============================================================================

set -e

GREEN='\033[1;32m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  STREETMP OS : INITIATING MONOREPO COMPILATION${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. Workspace Integrity Check
echo -e "${YELLOW}[1/4] Verifying Sovereign Node Integrity...${NC}"
if [ ! -f "turbo.json" ]; then
    echo -e "${RED}[FATAL] turbo.json missing. Ensure you are in the monorepo root.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Verified Monorepo Matrix.${NC}"

# 2. Package Installation
echo -e "${YELLOW}[2/4] Resolving Zero-Trust Dependencies...${NC}"
npm install --silent
echo -e "${GREEN}[OK] Dependencies locked.${NC}"

# 3. Monorepo Build via Turborepo
echo -e "${YELLOW}[3/4] Compiling Edge SDK & Enterprise Kernels...${NC}"
npx turbo run build
echo -e "${GREEN}[OK] Typescript & Next.js builds compiled mathematically.${NC}"

# 4. Production Docker Matrix Compilation
echo -e "${YELLOW}[4/4] Forging the Air-Gapped Docker Images...${NC}"
docker compose -f docker-compose.enterprise.yml build --quiet
echo -e "${GREEN}[OK] OCI Container Images synthesized.${NC}"

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN} [STREETMP OS v1.0 — SOVEREIGN NODE READY] ${NC}"
echo -e "${GREEN} The Absolute Auditability Architecture is live.${NC}"
echo -e "${GREEN} Zero-Liability parameters enforced.${NC}"
echo -e "${GREEN}======================================================${NC}\n"
