import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const { Pool } = pg;

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL = "commander@streetmp.local";
const PASSWORD = "StreetMP_GodMode_2026!";
const TIER = "OWNER";

async function seedAdmin() {
  const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USER || "streetmp",
    password: process.env.DB_PASS || "streetmp",
    database: process.env.DB_NAME || "streetmp_os",
  });

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_SALT_ROUNDS);

    await pool.query("DELETE FROM users WHERE email = $1", [EMAIL]);

    await pool.query(
      `INSERT INTO users (email, password_hash, account_tier, current_hcq_score)
       VALUES ($1, $2, $3, 0)`,
      [EMAIL, passwordHash, TIER]
    );

    console.log(`\n======================================================`);
    console.log(`✅ [SeedAdmin] SECURE INJECTION SUCCESSFUL`);
    console.log(`======================================================\n`);
    console.log(`The OWNER account has been bootstrapped in the master user table.`);
    console.log(`\nLocal Login Credentials:`);
    console.log(`  --> Email:    ${EMAIL}`);
    console.log(`  --> Password: ${PASSWORD}`);
    console.log(`\n======================================================\n`);
  } catch (err) {
    console.error(`[SeedAdmin] Error:`, err);
  } finally {
    await pool.end();
  }
}

seedAdmin();
