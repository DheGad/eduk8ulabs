/**
 * @file passport.ts
 * @package trust-pro
 * @description Global Trust Passport (HCQ 2.0 Signature)
 * 
 * Generates an Immutable Identity Passport for a StreetMP AI Node.
 * Used for Zero-Knowledge handshakes between sovereign enterprise clusters.
 */

import crypto from "crypto";

export interface NodeMetrics {
  node_id: string;
  uptime_hours: number;
  total_executions: number;
  verification_rate: number; // 0.0 to 1.0
  risk_score: number;        // 0.0 to 1.0 (lower is better)
  organization: string;
}

export interface TrustPassport {
  node_id: string;
  organization: string;
  trust_score: number;
  issued_at: string;
  signature: string;
}

export class TrustPassportIssuer {
  private readonly secretKey: string;

  constructor(secretKey?: string) {
    // In production, this must be derived from the HSM
    this.secretKey = secretKey || process.env.PASSPORT_ISSUING_KEY || "sovereign_fallback_key";
  }

  /**
   * Calculates the HCQ 2.0 Trust Score based on the Sovereign Formula:
   * T_score = (w1 * Uptime) + (w2 * Verification Rate) - (w3 * Risk Score)
   */
  private calculateScore(metrics: NodeMetrics): number {
    const w1 = 0.2; // Uptime weight (capped at max value)
    const w2 = 0.5; // Success/Verification weight
    const w3 = 0.3; // Risk penalty weight

    // Normalize uptime (assume 720 hours = 1.0 for score weighting)
    const normalizedUptime = Math.min(metrics.uptime_hours / 720, 1.0);

    const score = (w1 * normalizedUptime) + (w2 * metrics.verification_rate) - (w3 * metrics.risk_score);
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Issues a cryptographically signed passport proving the node's health and trustworthiness.
   */
  public issuePassport(metrics: NodeMetrics): TrustPassport {
    const score = this.calculateScore(metrics);
    const issuedAt = new Date().toISOString();

    const payload = {
      node_id: metrics.node_id,
      organization: metrics.organization,
      trust_score: Number(score.toFixed(4)),
      issued_at: issuedAt
    };

    const payloadString = JSON.stringify(payload);
    
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(payloadString)
      .digest("hex");

    return {
      ...payload,
      signature
    };
  }

  /**
   * Verifies the authenticity of a remote node's passport.
   */
  public verifyPassport(passport: TrustPassport): boolean {
    const payloadString = JSON.stringify({
      node_id: passport.node_id,
      organization: passport.organization,
      trust_score: passport.trust_score,
      issued_at: passport.issued_at
    });

    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(payloadString)
      .digest("hex");

    return expectedSignature === passport.signature;
  }
}
