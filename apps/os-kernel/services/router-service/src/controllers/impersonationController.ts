/**
 * @file controllers/impersonationController.ts
 * @service router-service
 * @phase Phase 7 — Titan 3.0 Sidecar
 * @description
 *   The Impersonation Vault. Generates a 15-minute JWT valid on the apps/web frontend 
 *   so HQ staff can view the system as exactly that user.
 */

import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { log } from "../utils/logger.js";

export async function generateImpersonationToken(req: Request, res: Response) {
  const { target_user_id, staff_user_id } = req.body;

  if (!target_user_id || !staff_user_id) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    // 1. Verify target user exists
    const userRes = await pool.query("SELECT id, email, role FROM users WHERE id = $1", [target_user_id]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Target user not found" });
    }
    const targetUser = userRes.rows[0];

    // 2. Generate a NextAuth-compatible JWT
    // NextAuth uses a specific JWT structure. To forge a seamless login from a separate app,
    // Next.js usually uses "next-auth.session-token". 
    // Here we generate a standard JWT that the Next.js frontend can accept via a magic impersonation API route.
    
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error("Missing JWT_SECRET");

    const payload = {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      is_impersonated: true,
      impersonator_id: staff_user_id
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: '15m' });

    // 3. Log into compliance_events (OS level)
    await pool.query(
      `INSERT INTO compliance_events (event_type, user_id, action, ip_address, description) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        "SUPERADMIN_IMPERSONATION",
        targetUser.id,
        "IMPERSONATE_START",
        req.socket.remoteAddress || "127.0.0.1",
        `HQ Staff ${staff_user_id} requested 15m impersonation`
      ]
    );

    // 4. Log into hq_audit_log (Sidecar level, Task 4)
    await pool.query(
      `INSERT INTO staff_hq.hq_audit_log (staff_id, action, target_user_id) 
       VALUES ((SELECT id FROM staff_hq.internal_staff WHERE username = $1), $2, $3)`,
      [
        staff_user_id,
        "GENERATE_IMPERSONATION_TOKEN",
        targetUser.id
      ]
    ).catch(err => log.error("Failed to insert hq_audit_log", err));

    log.warn("IMPERSONATION VAULT ACCESSED", { staff_user_id, target_user_id });

    // Return the token, which HQ UI can use to construct a redirect URL
    res.json({ success: true, token, target_email: targetUser.email });

  } catch (err) {
    log.error("Impersonation token generation failed", err as Error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
