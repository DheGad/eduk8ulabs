# StreetMP OS: Sovereign Enterprise Deployment Guide

**Classification:** STRICTLY CONFIDENTIAL  
**Target Audience:** Enterprise IT Infrastructure & Security Teams  
**Architecture Model:** Bring Your Own Cloud (BYOC) — Zero-Liability  

---

## 1. The Zero-Liability Philosophy

StreetMP OS was engineered with absolute mathematical certainty regarding data custody. We operate on a **Zero-Liability architecture**. 

We do not host your software. We do not process your data on our servers. You deploy the StreetMP OS strictly inside your own isolated VPCs on AWS, Azure, or bare metal. Your organization retains 100% custody of the Merkle transit logs, PostgreSQL ledgers, and Redis caches. 

With **Hold Your Own Key (HYOK)** via AWS KMS integration, StreetMP OS cryptographically ensures that the underlying data remains unreadable by anyone without your KMS root access—even us.

## 2. Architecture Matrix

The deployment package provisions five strictly isolated core services:

1. `streetmp-kernel`: The main operating system and execution engine.
2. `zk-sanitizer`: The Zero-Knowledge privacy engine that scrubs standard identifiers and PII before LLM queries.
3. `enforcer-guard`: The deterministic schema validator preventing anomalous logic.
4. `redis-cache`: High-speed memory store for the Ghost Proxy layer.
5. `postgres-ledger`: The persistent Merkle audit log for non-repudiable state trails.

### Network Constraints
The deployment defines strict internal barriers:
- **`external-net`**: Routes internet-bound traffic directly to the `streetmp-kernel`.
- **`internal-net`**: Completely air-gapped from the host network. The database, cache, sanitizer, and enforcer communicate exclusively on an isolated bridge network, rendering direct network infiltration mathematically impossible from the external edge.

## 3. "One-Click" Genesis Protocol

### Prerequisites
1. Dedicated Linux Subsystem (Ubuntu 22.04 LTS or RHEL 9 recommended).
2. `docker` daemon and `docker compose` plugin active.
3. A pre-provisioned AWS KMS Key ID.

### Ignition Sequence

1. **Verify Integrity and Clone Package**
   Navigate to the target directory and inspect the scripts.

2. **Run Genesis Script**
   Execute the automated provisioning script. On first run, it detects the un-configured state, automatically generates 256-bit cryptographically secure passwords for the isolated data stores, and clones the configuration template.
   ```bash
   chmod +x scripts/deploy-genesis.sh
   ./scripts/deploy-genesis.sh
   ```

3. **Provide Master Key (HYOK)**
   The script will halt and prompt you to inject your KMS Key. Open `.env.enterprise` and set your key:
   ```env
   AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:XXXXXXXXXXXX:key/your-key-uuid
   ```

4. **Initialize Subsystems**
   Re-run the script to finalize ignition:
   ```bash
   ./scripts/deploy-genesis.sh
   ```

**Result:** The StreetMP Enterprise Kernel is fully operational. Everything operates under your total sovereign control.
