/**
 * @file apps/os-kernel/scripts/bootAdmin.ts
 * @description God-Mode Admin Seeder — Command 075 Operation Bootstrap
 *
 * This script directly injects an OWNER-tier account into the master users
 * table, bypassing the standard registration flow for local testing only.
 *
 * Usage:
 *   npx tsx apps/os-kernel/scripts/bootAdmin.ts
 *
 * Requirements:
 *   - PostgreSQL must be running with the schema already applied.
 *   - .env must be loaded at the monorepo root (or DB vars set in environment).
 */

import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load the root .env from the monorepo root (4 levels up from this file)
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const { Pool } = pg;

// ----------------------------------------------------------------
// GOD-MODE CREDENTIALS — LOCAL TESTING ONLY
// ----------------------------------------------------------------
const EMAIL    = "commander@streetmp.local";
const PASSWORD = "StreetMP_GodMode_2026!";
const TIER     = "OWNER";
const BCRYPT_SALT_ROUNDS = 10; // MUST match auth-service/src/routes.ts line 46

async function bootAdmin(): Promise<void> {
  const pool = new Pool({
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT || "5432", 10),
    user:     process.env.DB_USER     || "streetmp",
    password: process.env.DB_PASS     || "streetmp_dev_password",
    database: process.env.DB_NAME     || "streetmp_os",
  });

  console.log(`\n[BootAdmin] Connecting to PostgreSQL at ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || "5432"}...`);

  try {
    // Verify connection first
    await pool.query("SELECT 1");
    console.log(`[BootAdmin] ✅ Database connection established.`);

    // Hash the password using bcrypt (same algorithm as auth-service)
    console.log(`[BootAdmin] Hashing credentials with bcrypt (rounds=${BCRYPT_SALT_ROUNDS})...`);
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);

    // Idempotent upsert: wipe and recreate to always get a clean state
    await pool.query("DELETE FROM users WHERE email = $1", [EMAIL]);

    await pool.query(
      `INSERT INTO users (email, password_hash, account_tier, current_hcq_score)
       VALUES ($1, $2, $3, 0)`,
      [EMAIL, passwordHash, TIER]
    );

    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`║  ✅  GOD-MODE BOOTSTRAP: SUCCESSFUL                  ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  Tier:      OWNER (Full System Access)               ║`);
    console.log(`║  Email:     commander@streetmp.local                 ║`);
    console.log(`║  Password:  StreetMP_GodMode_2026!                   ║`);
    console.log(`╠══════════════════════════════════════════════════════╣`);
    console.log(`║  Login:     http://localhost:3000/login               ║`);
    console.log(`║  Dashboard: http://localhost:3000/dashboard/admin     ║`);
    console.log(`║  Traces:    http://localhost:3000/dashboard/admin/traces ║`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[BootAdmin] ❌ FAILED: ${msg}`);
    console.error(`\nTroubleshooting:`);
    console.error(`  1. Is PostgreSQL running?  → docker compose up -d`);
    console.error(`  2. Is the schema applied?  → psql -U streetmp -d streetmp_os -f packages/database/schema.sql`);
    console.error(`  3. Are DB env vars set?    → check your .env file`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

bootAdmin();
