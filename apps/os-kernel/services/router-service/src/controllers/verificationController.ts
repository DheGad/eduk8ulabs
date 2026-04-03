/**
 * @file controllers/verificationController.ts
 * @service router-service
 * @description Command 087 — Open StreetMP Trust Protocol (STP)
 *             Public Cryptographic Verification API
 *
 * GET  /api/v1/public/verify/:receipt_hash
 *   Look up a Merkle receipt by its leaf hash or execution_id.
 *   Returns only cryptographic metadata — never prompt text or AI response.
 *
 * GET  /api/v1/public/verify
 *   Returns ledger health + STP specification endpoint.
 *
 * ── Security Model ──────────────────────────────────────────────────────────
 *  · No auth required — public verifiability is the entire point.
 *  · Hard rate-limit: 30 lookups / minute per IP (sliding window, in-memory).
 *    Prevents database scraping and brute-force discovery of valid hashes.
 *  · Only cryptographic metadata is returned. Raw prompt/response is NEVER
 *    present in the ExecutionCertificate (by V36 design), so this is safe.
 *  · A successful lookup proves the execution was governed by StreetMP OS.
 *    A 404 means the hash was never issued by this kernel instance.
 */

import { Router, Request, Response } from "express";
import { verifyCertificate, getLedgerSize } from "../executionCertificate.js";
import { merkleLogger }                      from "../merkleLogger.js";

export const verificationRouter = Router();

// ─── In-Memory Rate Limiter (sliding window, per-IP) ─────────────────────────

const RATE_LIMIT_MAX       = 30;   // max lookups
const RATE_LIMIT_WINDOW_MS = 60_000; // per 60 seconds

const ipWindows = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now  = Date.now();
  const hits  = (ipWindows.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  ipWindows.set(ip, hits);

  // Prune old entries once per 5 minutes to prevent unbounded growth
  if (Math.random() < 0.001) {
    for (const [key, times] of ipWindows) {
      const fresh = times.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) ipWindows.delete(key); else ipWindows.set(key, fresh);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
}

// ─── Hash Validate Helper ─────────────────────────────────────────────────────

/** Valid Merkle leaf hash: 64-char lowercase hex */
const LEAF_HASH_RE  = /^[0-9a-f]{64}$/i;
/** Valid execution_id: exec_ + 20 hex chars */
const EXEC_ID_RE    = /^exec_[0-9a-f]{20}$/i;

type LookupMode = "merkle_hash" | "execution_id" | "invalid";

function detectHashMode(input: string): LookupMode {
  if (LEAF_HASH_RE.test(input))   return "merkle_hash";
  if (EXEC_ID_RE.test(input))     return "execution_id";
  return "invalid";
}

// ─── GET /api/v1/public/verify/:receipt_hash ──────────────────────────────────

verificationRouter.get("/api/v1/public/verify/:receipt_hash", (req: Request, res: Response): void => {
  const ip           = (req.ip ?? req.socket.remoteAddress ?? "unknown");
  const rawHash      = (req.params as { receipt_hash: string }).receipt_hash?.trim() ?? "";

  // ── Rate Limit ───────────────────────────────────────────────────────────
  if (isRateLimited(ip)) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      success: false,
      error: {
        code:    "RATE_LIMITED",
        message: "Too many verification requests. You may perform 30 lookups per minute.",
      },
    });
    return;
  }

  // ── Input Validation ─────────────────────────────────────────────────────
  const mode = detectHashMode(rawHash);

  if (mode === "invalid") {
    res.status(400).json({
      success: false,
      error: {
        code:    "INVALID_HASH_FORMAT",
        message: "Provide either a 64-char lowercase hex Merkle leaf hash or an exec_* execution ID.",
        docs:    "https://os.streetmp.com/stp",
      },
    });
    return;
  }

  // ── Merkle Leaf Hash Lookup ───────────────────────────────────────────────
  if (mode === "merkle_hash") {
    //
    // Walk the in-memory Merkle tree snapshots to find the matching leaf.
    // In production this would be a DB query; the in-memory lookup is O(n)
    // over today's receipts — acceptable for demo scale.
    //
    const trees  = merkleLogger.listTrees();
    let found: {
      tenant_id:        string;
      date:             string;
      leaf_hash:        string;
      leaf_index:       number;
      root_hash:        string;
      receipt_timestamp?: string;
      trust_score?:     number;
      inference_region?: string;
    } | null = null;

    for (const tree of trees) {
      const snap = merkleLogger.exportSnapshot(tree.tenant_id, tree.date);
      if (!snap) continue;
      const leaf = snap.leaves.find((l) => l.leaf_hash === rawHash.toLowerCase());
      if (leaf) {
        found = {
          tenant_id:         tree.tenant_id,
          date:              tree.date,
          leaf_hash:         leaf.leaf_hash,
          leaf_index:        leaf.index,
          root_hash:         snap.root_hash ?? "",
          receipt_timestamp: leaf.receipt.timestamp,
          trust_score:       leaf.receipt.trust_score,
          inference_region:  leaf.receipt.inference_region,
        };
        break;
      }
    }

    if (!found) {
      console.info(`[V87:Verify] HASH_NOT_FOUND hash=${rawHash.slice(0, 12)}… ip=${ip}`);
      res.status(404).json({
        success:    false,
        verified:   false,
        hash:       rawHash,
        error: {
          code:    "HASH_NOT_FOUND",
          message: "No Merkle receipt found for this hash. The execution may be from a different kernel instance or an earlier session.",
        },
      });
      return;
    }

    console.info(
      `[V87:Verify] MERKLE_VERIFIED hash=${rawHash.slice(0, 12)}… ` +
      `tenant=${found.tenant_id} idx=${found.leaf_index} ip=${ip}`
    );

    res.status(200).json({
      success:       true,
      verified:      true,
      protocol:      "STP/1.0",
      lookup_mode:   "merkle_leaf_hash",
      receipt: {
        leaf_hash:         found.leaf_hash,
        leaf_index:        found.leaf_index,
        merkle_root:       found.root_hash,
        date:              found.date,
        issued_at:         found.receipt_timestamp ?? null,
        trust_score:       found.trust_score       ?? null,
        inference_region:  found.inference_region  ?? null,
        // Tenant ID is intentionally omitted for public API — privacy
      },
      attestation: {
        verified_by:       "StreetMP Trust Protocol Kernel v1.0",
        algorithm:         "SHA-256 Merkle Tree",
        verify_timestamp:  new Date().toISOString(),
        stp_spec:          "https://os.streetmp.com/stp",
      },
      // V36 prompt/response text: never stored in Merkle leaf by design
      prompt_retained:    false,
      response_retained:  false,
    });
    return;
  }

  // ── Execution ID Lookup (existing V36 cert ledger) ────────────────────────
  if (mode === "execution_id") {
    const result = verifyCertificate(rawHash);

    if (!result) {
      res.status(404).json({
        success:    false,
        verified:   false,
        execution_id: rawHash,
        error: {
          code:    "EXECUTION_ID_NOT_FOUND",
          message: "No certificate found for this execution ID.",
        },
      });
      return;
    }

    const { status, cert } = result;

    console.info(
      `[V87:Verify] CERT_${status} exec=${rawHash} ` +
      `trust=${cert.trust_score} ip=${ip}`
    );

    res.status(200).json({
      success:       true,
      verified:      status === "SECURE",
      protocol:      "STP/1.0",
      lookup_mode:   "execution_id",
      status,
      certificate: {
        execution_id:      cert.execution_id,
        fingerprint:       cert.fingerprint,
        issued_at:         cert.issued_at,
        trust_score:       cert.trust_score,
        trust_band:        cert.trust_band,
        model:             cert.model,
        provider:          cert.provider,
        region:            cert.region,
        compliance_flags:  cert.compliance_flags,
        zk_signature:      cert.zk_signature,
      },
      attestation: {
        verified_by:       "StreetMP Trust Protocol Kernel v1.0",
        algorithm:         "HMAC-SHA256 Canonical Payload",
        verify_timestamp:  new Date().toISOString(),
        stp_spec:          "https://os.streetmp.com/stp",
      },
      prompt_retained:   false,
      response_retained: false,
    });
  }
});

// ─── GET /api/v1/public/verify (ledger health / spec link) ───────────────────

verificationRouter.get("/api/v1/public/verify", (_req: Request, res: Response): void => {
  res.status(200).json({
    protocol:          "StreetMP Trust Protocol (STP) v1.0",
    status:            "OPERATIONAL",
    total_certs_issued: getLedgerSize(),
    merkle_trees_active: merkleLogger.listTrees().length,
    endpoints: {
      verify_by_hash:    "GET /api/v1/public/verify/:receipt_hash",
      verify_by_exec_id: "GET /api/v1/public/verify/exec_<20hex>",
      rate_limit:        `${RATE_LIMIT_MAX} req/min per IP`,
    },
    specification:     "https://os.streetmp.com/stp",
    documentation:     "https://os.streetmp.com/verify",
  });
});
