/**
 * @file gen.ts
 * @package infra-pro
 * @description The Sovereign Node Configurator Engine
 * 
 * Implements C048 Task 2.
 * Generates the `docker-compose.sovereign.yml` dynamically for an enterprise client.
 * Injects the Trust Passport Signature as an environment variable to prove the node's
 * authenticity during swarm federation.
 */

import { TrustPassportIssuer } from "@streetmp-os/trust-pro";
import crypto from "crypto";

export interface ProvisionConfig {
  organizationId: string;
  infrastructureId: string;
  securityTier: "standard" | "hyok";
  region: string;
}

export class NodeConfigurator {
  private issuer: TrustPassportIssuer;

  constructor(issuerKey: string = process.env.PASSPORT_ISSUING_KEY || "streetmp_hq_root_key") {
    this.issuer = new TrustPassportIssuer(issuerKey);
  }

  /**
   * Generates the custom docker-compose YAML payload for a client's private node.
   */
  public generateDockerCompose(config: ProvisionConfig): string {
    const nodeId = `node-srv-${crypto.randomUUID().substring(0, 12)}`;
    
    // We issue a Genesis Trust Passport for this new node to authorise its network entry
    const genesisPassport = this.issuer.issuePassport({
      node_id: nodeId,
      organization: config.organizationId,
      uptime_hours: 0,
      total_executions: 0,
      verification_rate: 1.0, 
      risk_score: 0.0
    });

    // The core Docker template structure
    const composeYaml = `
# ======================================================================
# STREETMP OS - SOVEREIGN PRIVATE NODE
# ======================================================================
# Org ID: ${config.organizationId}
# Region Targeting: ${config.region}
# Node Auth Protocol: ZK_STREETMP_v1
# ======================================================================

version: '3.8'

services:
  api-gateway:
    image: streetmp/api-gateway:enterprise-latest
    networks:
      - streetmp_airgap
    ports:
      - "443:4000"
    environment:
      - NODE_ENV=production
      - STREETMP_NODE_ID=${nodeId}
      - STREETMP_ORG_ID=${config.organizationId}
      - SOVEREIGN_PASSPORT_SIG=${genesisPassport.signature}
      - SECURITY_TIER=${config.securityTier.toUpperCase()}

  router-service:
    image: streetmp/router-service:enterprise-latest
    networks:
      - streetmp_airgap
    environment:
      - PINO_LOG_LEVEL=info

  ${config.securityTier === "hyok" ? `
  hsm-sanitizer:
    image: streetmp/sanitizer-service:sgx-enclave
    networks:
      - streetmp_airgap
    volumes:
      - /var/run/hsm:/var/run/hsm:ro
    environment:
      - SYOK_ENABLED=true
  ` : ""}

  enforcer-service:
    image: streetmp/enforcer-service:enterprise-latest
    networks:
      - streetmp_airgap

networks:
  streetmp_airgap:
    driver: bridge
    internal: ${config.securityTier === "hyok" ? "true" : "false"}
`;

    return composeYaml.trim();
  }
}
