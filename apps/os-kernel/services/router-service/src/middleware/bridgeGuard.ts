/**
 * @file middleware/bridgeGuard.ts
 * @service router-service
 * @phase Phase 7 — Titan 3.0 Sidecar
 * @description
 *   The Secure Command Bridge restricts access to the Sidecar HQ endpoints.
 *   Validates HQ_ALLOWED_IPS (default 127.0.0.1) and TITAN_BRIDGE_KEY.
 */

import { Request, Response, NextFunction } from "express";
import { log } from "../utils/logger.js";
import crypto from "crypto";

export function bridgeGuard(req: Request, res: Response, next: NextFunction): void {
  // 1. IP Check
  const allowed = process.env.HQ_ALLOWED_IPS || "127.0.0.1";
  const remoteIp = (req.socket.remoteAddress || "").replace("::ffff:", "");
  
  // Basic loopback allowing for now when decoupled locally
  if (remoteIp !== "127.0.0.1" && remoteIp !== "::1" && !allowed.split(",").includes(remoteIp)) {
    log.warn("Unauthorized HQ Bridge access attempt (IP mismatch)", { ip: remoteIp });
    res.status(404).json({ error: "Not Found" });
    return;
  }

  // 2. Titan Key Check
  const providedKey = req.headers["x-titan-bridge-key"] as string | undefined;
  const expectedKey = process.env.TITAN_BRIDGE_KEY;

  if (!providedKey || !expectedKey || providedKey.length !== 64 || expectedKey.length !== 64) {
    log.warn("Unauthorized HQ Bridge access attempt (Key missing or invalid length)", { ip: remoteIp });
    res.status(404).json({ error: "Not Found" });
    return;
  }

  // Constant-time string comparison to prevent timing attacks
  const bufProvided = Buffer.from(providedKey, "utf8");
  const bufExpected = Buffer.from(expectedKey, "utf8");

  if (!crypto.timingSafeEqual(bufProvided, bufExpected)) {
    log.warn("Unauthorized HQ Bridge access attempt (Key mismatch)", { ip: remoteIp });
    res.status(404).json({ error: "Not Found" });
    return;
  }

  next();
}
