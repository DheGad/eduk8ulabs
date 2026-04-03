#!/usr/bin/env npx tsx
/**
 * @file scripts/bootstrapTitan.ts
 * @phase Phase 6 — Titan Hardening
 * @description
 *   Bootstrap utility to create the initial God-Mode system admin account.
 *   Fails if the system_admins table is not empty.
 *
 *   Usage: npx tsx bootstrapTitan.ts
 */

import { pool } from "../db.js";
import bcrypt from "bcrypt";
import * as readline from "readline/promises";

async function main() {
  console.log("=== STREETMP OS TITAN BOOTSTRAP ===");

  const { rows } = await pool.query("SELECT COUNT(*) FROM system_admins");
  if (parseInt(rows[0].count, 10) > 0) {
    console.error("❌ Action Rejected: The system_admins table is not empty. Titan account already exists.");
    process.exit(1);
  }

  const username = "admin_titan";
  const password = "Titan_Initial_2026!";

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nPROVISION 'GOD_MODE' ADMIN\nUsername: ${username}\nPassword: ${password}\n\nProceed? (yes/no): `);
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO system_admins (username, password_hash, requires_reset) VALUES ($1, $2, TRUE)`,
    [username, hash]
  );

  console.log("\n✅ SUCCESS: Titan SuperAdmin provisioned.");
  console.log("You may now log in to the system. You will be required to change this password immediately.");
  process.exit(0);
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
