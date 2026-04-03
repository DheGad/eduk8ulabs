#!/usr/bin/env bash
# ============================================================
# enclave/BUILD.md — Local Development & AWS Deployment Guide
# ============================================================
# 
# AWS Nitro Enclave Support requires: nitro-cli, Docker, and
# either an m5/c5/r5 instance with Nitro Enclave support enabled.
# ============================================================

set -e

GREEN='\033[1;32m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  STREETMP OS V4 — Enclave Build Matrix${NC}"
echo -e "${CYAN}======================================================${NC}"

# ── Step 1: Compile Rust for musl (required for Nitro EIF images)
echo -e "${YELLOW}[1/3] Compiling Rust enclave binary for musl target...${NC}"
rustup target add x86_64-unknown-linux-musl 2>/dev/null
cargo build --release \
  --manifest-path enclave/nitro-tokenizer/Cargo.toml \
  --target x86_64-unknown-linux-musl

echo -e "${GREEN}[OK] Rust binary compiled.${NC}"

# ── Step 2: Package as Nitro EIF image
echo -e "${YELLOW}[2/3] Packaging as Nitro Enclave Image File (EIF)...${NC}"
nitro-cli build-enclave \
  --docker-uri nitro-tokenizer \
  --output-file enclave/nitro-tokenizer.eif

echo -e "${GREEN}[OK] EIF image built.${NC}"

# ── Step 3: Install Node.js bridge dependencies
echo -e "${YELLOW}[3/3] Installing Node.js bridge dependencies...${NC}"
npm install --prefix enclave/bridge

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN} Enclave build complete.${NC}"
echo -e "${GREEN} To run in production:${NC}"
echo -e "${GREEN}   nitro-cli run-enclave --enclave-cid 3 --memory 512 --cpu-count 2 \\${NC}"
echo -e "${GREEN}     --eif-path enclave/nitro-tokenizer.eif${NC}"
echo -e "${GREEN} To test locally (socat bridge):${NC}"
echo -e "${GREEN}   cargo run --manifest-path enclave/nitro-tokenizer/Cargo.toml${NC}"
echo -e "${GREEN}   ENCLAVE_CID=1 npx tsx enclave/bridge/src/vsock-client.ts${NC}"
echo -e "${GREEN}======================================================${NC}\n"
