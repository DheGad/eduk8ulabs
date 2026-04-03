/**
 * @file verifyService.ts
 * @service router-service
 * @version V36
 * @description Public Cryptographic Verification Endpoint
 *
 * Exposes a single, public, unauthenticated endpoint that any
 * third party (regulator, enterprise auditor, partner) can call
 * to validate the integrity of a StreetMP execution certificate.
 *
 * GET /verify/:execution_id
 *
 * Response shape:
 *   {
 *     status: "SECURE" | "TAMPERED" | "NOT_FOUND",
 *     execution_id: string,
 *     trust_score: number,
 *     trust_band: string,
 *     fingerprint: string,
 *     issued_at: string,
 *     compliance_flags: string[],
 *     zk_signature: string,  // The stored HMAC
 *   }
 */

import { Router, Request, Response } from "express";
import { verifyCertificate, getLedgerSize } from "./executionCertificate.js";

export const verifyRouter = Router();

// ── GET /verify/:execution_id ─────────────────────────────────────────────────

verifyRouter.get("/:execution_id", (req: Request, res: Response) => {
  const { execution_id } = req.params as { execution_id: string };

  if (!execution_id || !execution_id.startsWith("exec_")) {
    return res.status(400).json({
      status: "NOT_FOUND",
      error: "Invalid execution_id format. Must begin with 'exec_'.",
    });
  }

  const clientSig = req.headers["x-streetmp-client-signature"] as string | undefined;
  const result = verifyCertificate(execution_id, clientSig);

  if (!result) {
    console.warn(`[V36:VerifyService] Unknown execution_id: ${execution_id}`);
    return res.status(404).json({
      status:       "NOT_FOUND",
      execution_id,
      message:      "No certificate found for this execution ID.",
    });
  }

  const { status, cert } = result;

  if (status === "TAMPERED") {
    console.error(`[V36:VerifyService] TAMPER DETECTED for execution_id: ${execution_id}`);
  } else {
    console.info(`[V36:VerifyService] SECURE ✅ execution_id: ${execution_id}`);
  }

  return res.status(200).json({
    status,
    execution_id:      cert.execution_id,
    trust_score:       cert.trust_score,
    trust_band:        cert.trust_band,
    fingerprint:       cert.fingerprint,
    issued_at:         cert.issued_at,
    model:             cert.model,
    provider:          cert.provider,
    region:            cert.region,
    compliance_flags:  cert.compliance_flags,
    zk_signature:      cert.zk_signature,
    verified_by:       "StreetMP Sovereign Kernel v2.0",
    verify_timestamp:  new Date().toISOString(),
  });
});

// ── GET /verify (ledger health) ───────────────────────────────────────────────

verifyRouter.get("/", (_req: Request, res: Response) => {
  return res.status(200).json({
    service:          "StreetMP Execution Certificate Verifier",
    version:          "V36",
    total_issued:      getLedgerSize(),
    status:           "OPERATIONAL",
    documentation:    "GET /verify/:execution_id to verify any issued certificate",
  });
});
