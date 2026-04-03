#!/usr/bin/env bash
# ============================================================
# StreetMP OS: Enterprise "One-Click" Deploy Script
# Zero-Liability BYOC Architecture
# ============================================================

set -e

GREEN='\033[1;32m'
CYAN='\033[1;36m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}  STREETMP OS : ENTERPRISE GENESIS DEPLOYMENT${NC}"
echo -e "${CYAN}======================================================${NC}"

# Check Docker installation
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed.${NC}"
    exit 1
fi
if ! docker compose version &> /dev/null; then
    echo -e "${RED}[ERROR] Docker Compose plugin is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Containerization engine verified.${NC}"

# Configure Environment
ENV_FILE=".env.enterprise"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}[!] $ENV_FILE not found. Cloning secure template...${NC}"
    cp .env.enterprise.example $ENV_FILE
    
    echo -e "${YELLOW}Synthesizing cryptographic secrets for isolated ledgers...${NC}"
    DB_PASS=$(openssl rand -hex 32)
    REDIS_PASS=$(openssl rand -hex 32)
    
    # Cross-platform sed
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i "" "s/__SECURE_PASSWORD__/$DB_PASS/g" $ENV_FILE
        sed -i "" "s/__SECURE_REDIS_PASSWORD__/$REDIS_PASS/g" $ENV_FILE
    else
        sed -i "s/__SECURE_PASSWORD__/$DB_PASS/g" $ENV_FILE
        sed -i "s/__SECURE_REDIS_PASSWORD__/$REDIS_PASS/g" $ENV_FILE
    fi
    
    echo -e "${GREEN}[OK] Secure environment injected.${NC}"
    echo -e "${YELLOW}[ACTION REQUIRED] Please edit $ENV_FILE to provide your AWS_KMS_KEY_ID before ignition.${NC}"
    echo -e "${YELLOW}Run this script again when ready.${NC}"
    exit 0
fi

# Ignite OS
echo -e "${YELLOW}Igniting the Matrix inside your isolated perimeter...${NC}"
docker compose -f docker-compose.enterprise.yml --env-file $ENV_FILE up -d

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN} STREETMP OS KERNEL IS ONLINE.${NC}"
echo -e "${GREEN} 100% Data Custody is maintained on your infrastructure.${NC}"
echo -e "${GREEN}======================================================${NC}\n"
