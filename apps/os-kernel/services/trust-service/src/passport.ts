/**
 * @file passport.ts
 * @package trust-service
 * @description Global AI Trust Identity (HCQ 2.0)
 *
 * Generates an immutable, HMAC-SHA256 signed `trust-passport.json` for any
 * Enterprise user. This acts as a cryptographic "Credit Score" for AI reliability.
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { Pool } from "pg";

export const passportRouter = Router();

// In production, this would use a HSM (Hardware Security Module) like AWS KMS.
const PASSPORT_SIGNING_SECRET = process.env.PASSPORT_SIGNING_SECRET || "streetmp_dev_secret_key_99";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://streetmp:streetmp_pass@localhost:5432/streetmp_os"
});

export interface TrustPassport {
  user_id: string;
  hcq_score: number;
  success_rate: number;
  verified_executions: number;
  signature: string;
}

/**
 * Endpoint: GET /api/v1/trust/passport/:user_id
 * Returns the `trust-passport.json` format.
 */
passportRouter.get("/passport/:user_id", async (req: Request, res: Response) => {
  const { user_id } = req.params;

  try {
    // 1. Fetch live metrics from the OS Database
    // In a real scenario, this aggregates data from usage_logs and execution_proofs
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM execution_proofs ep 
         JOIN usage_logs ul ON ep.usage_log_id = ul.id 
         WHERE ul.user_id = $1) as verified_executions,
        (SELECT AVG(trust_score) FROM usage_logs WHERE user_id = $1) as hcq_score
    `;
    const { rows } = await pool.query(query, [user_id]);
    
    // Defaulting logic for new users
    const verifiedExecs = parseInt(rows[0]?.verified_executions || "0", 10);
    const avgHcq = parseFloat(rows[0]?.hcq_score || "0.95");
    
    // Simulate a success rate modifier based on volume
    const successRate = Math.min(0.99, 0.85 + (verifiedExecs * 0.001));

    // 2. Build the Payload (excluding signature)
    const payload = {
      user_id,
      hcq_score: Number(avgHcq.toFixed(3)),
      success_rate: Number(successRate.toFixed(3)),
      verified_executions: verifiedExecs
    };

    // 3. Cryptographic Tamper-Proofing (HMAC-SHA256)
    const payloadString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", PASSPORT_SIGNING_SECRET)
      .update(payloadString)
      .digest("hex");

    // 4. Final `trust-passport.json` shape
    const passport: TrustPassport = {
      ...payload,
      signature
    };

    res.status(200).json(passport);

  } catch (err: any) {
    console.error("[TrustService:Passport] Failed to generate passport:", err.message);
    res.status(500).json({ error: "PASSPORT_GENERATION_FAILED" });
  }
});

/**
 * Endpoint: POST /api/v1/trust/passport/verify
 * Public endpoint to verify a submitted passport is authentic.
 */
passportRouter.post("/passport/verify", (req: Request, res: Response) => {
  const { user_id, hcq_score, success_rate, verified_executions, signature } = req.body;

  if (!signature) {
    res.status(400).json({ valid: false, error: "Missing signature" });
    return;
  }

  const payloadString = JSON.stringify({ user_id, hcq_score, success_rate, verified_executions });
  
  const expectedSignature = crypto
    .createHmac("sha256", PASSPORT_SIGNING_SECRET)
    .update(payloadString)
    .digest("hex");

  if (expectedSignature === signature) {
    res.status(200).json({ valid: true, message: "Cryptographically authentic." });
  } else {
    res.status(403).json({ valid: false, error: "TAMPERED_PASSPORT" });
  }
});
