#!/usr/bin/env npx tsx
/**
 * @file scripts/bootstrapHq.ts
 * @phase Phase 7 — Titan 3.0 Sidecar
 * @description Links an existing user to the Staff HQ 'SUPER' role.
 */

import { pool } from "../db.js";
import crypto from "crypto";

async function main() {
  console.log("=== TITAN HQ V1.0 SOVEREIGN BOOTSTRAP ===");

  const ceoEmail = "dheeraj@streetmp.com";
  const ceoUsername = "dheeraj_ceo";

  const { rows } = await pool.query("SELECT COUNT(*) FROM staff_hq.internal_staff");
  if (parseInt(rows[0].count, 10) > 0) {
    console.log("HQ already seeded. Bypassing.");
    process.exit(0);
  }

  // Ensure Dheeraj is in public.users
  let userRes = await pool.query("SELECT id FROM public.users WHERE email = $1", [ceoEmail]);
  if (userRes.rowCount === 0) {
     userRes = await pool.query(
        "INSERT INTO public.users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [ceoEmail, "Dheeraj Gadepalli", "TEMP_HASH_REPLACE"]
     );
  }
  const userId = userRes.rows[0].id;

  // Insert into staff_hq
  await pool.query(
    `INSERT INTO staff_hq.internal_staff (user_id, username, admin_role) VALUES ($1, $2, 'SUPER') ON CONFLICT (user_id) DO NOTHING`,
    [userId, ceoUsername]
  );

  // Insert into system_admins (Phase 6 table) with forced reset
  const tempPass = "Titan_Initial_2026!";
  const hash = crypto.createHash('sha256').update(tempPass).digest('hex'); // Mock hash for script simplicity
  
  await pool.query(
    `INSERT INTO system_admins (username, email, password_hash, role, require_password_reset) 
     VALUES ($1, $2, $3, 'GOD_MODE', true) ON CONFLICT (email) DO NOTHING`,
    [ceoUsername, ceoEmail, hash]
  );

  console.log(`\n✅ SUCCESS: CEO linked. Login with ${ceoUsername} / ${tempPass}`);
  console.log(`✅ REQUIREMENT: Password reset flag is set to TRUE.`);
  process.exit(0);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
