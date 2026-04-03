#!/usr/bin/env bash

# ==============================================================================
# STREETMP OS : THE FINAL SYSTEM IGNITION
# Phase 10 | Command 065 (RECOVERY CONFIG)
# ==============================================================================

set -e

# ANSI Colors for UI
GREEN='\033[1;32m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  STREETMP OS : IGNITION SEQUENCE INITIATED${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. Boot Primary Data Vaults
echo -e "${YELLOW}[1/4] Booting Core Infrastructure (PostgreSQL, Redis)...${NC}"
docker compose -f docker-compose.prod.yml up -d postgres-vault redis-cache

# 2. Wait for Vault Initialization
echo -e "${YELLOW}[2/4] Initializing Database Integrity (Waiting 5s)...${NC}"
sleep 5

# 3. Seed Founder & Golden Key
echo -e "${YELLOW}[3/4] Synthesizing Founder Account and The Golden Key...${NC}"
npx tsx scripts/genesis-boot.ts

# 4. Boot Core OS and Proxies
echo -e "${YELLOW}[4/4] Engaging the 7 Core Microservices and Caddy Proxy...${NC}"
docker compose -f docker-compose.prod.yml up -d

# 5. Continuous Core Health Check loop
echo -e "${YELLOW}Executing Edge Routing Health Pulse against api.streetmp.com...${NC}"

MAX_RETRIES=30
RETRIES=0

# Use curl with -s (silent), -o /dev/null, and -w "%{http_code}" to grab just the status code
# Expecting an eventual 200 OK from the routed proxy
until [ $(curl -s -o /dev/null -w "%{http_code}" https://api.streetmp.com/health || echo "failure") == "200" ]; do
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo -e "\n${RED}[FATAL ERROR] System Ignition timeout. API Edge Router unresponsive.${NC}"
    exit 1
  fi
  sleep 2
  printf "."
  RETRIES=$((RETRIES+1))
done

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN} STREETMP OS IS ONLINE. THE MACHINE ECONOMY HAS BEGUN.${NC}"
echo -e "${GREEN}======================================================${NC}\n"
