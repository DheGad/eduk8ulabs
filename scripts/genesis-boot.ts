import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://streetmp_os:antigravity_core@localhost:5432/streetmp_os_dev',
});

async function runGenesis() {
  console.log(`\n======================================================`);
  console.log(`⚡ SYSTEM IGNITION: THE GENESIS BOOT`);
  console.log(`======================================================\n`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. CREATE FOUNDER ACCOUNT
    const founderEmail = process.env.FOUNDER_EMAIL || "founder@streetmp.com";
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = crypto.createHash('sha256').update(tempPassword).digest('hex'); 

    console.log(`[GENESIS] Injecting Founder Singularity: ${founderEmail}`);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, account_tier, current_hcq_score)
       VALUES ($1, $2, 'superuser', 100.00)
       ON CONFLICT (email) DO UPDATE SET account_tier = 'superuser', current_hcq_score = 100.00
       RETURNING id`,
      [founderEmail, hashedPassword]
    );

    const founderId = userRes.rows[0].id;
    console.log(`[GENESIS] ✅ Founder seeded. Matrix ID: ${founderId}`);

    // 2. GENERATE STREETMP_GOLDEN_KEY
    console.log(`[GENESIS] Forging the STREETMP_GOLDEN_KEY (Offline Emergency Override)...`);
    
    // 64-character (32 random bytes) hex string
    const rawKey = `streetmp_golden_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    await client.query(
      `INSERT INTO s2s_api_keys (user_id, api_key_hash, key_hint, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (api_key_hash) DO NOTHING`,
      [founderId, keyHash, rawKey.slice(-8), "MASTER_EMERGENCY_OVERRIDE"]
    );

    // 3. WRITE THE OFFLINE .genesis.secret
    const secretPath = path.join(process.cwd(), '.genesis.secret');
    const secretPayload = `
======================================================
STREETMP OS - GENESIS MASTER KEY
GENERATED: ${new Date().toISOString()}
FOUNDER EMAIL: ${founderEmail}
======================================================

STREETMP_GOLDEN_KEY=${rawKey}
DB_UUID=${founderId}

WARNING: STRICTLY CONFIDENTIAL. THIS IS AN UNRESTRICTED CORE TOKEN.
STORE IN AIR-GAPPED COLD STORAGE ENCLOSURE ONLY.
======================================================
    `.trim();

    fs.writeFileSync(secretPath, secretPayload, { mode: 0o600 });
    console.log(`[GENESIS] ✅ SECURITY: Golden Key forged and vaulted to .genesis.secret`);

    // Ensure it's in .gitignore (surgical append)
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignorePath)) {
       const gitignore = fs.readFileSync(gitignorePath, 'utf8');
       if (!gitignore.includes('.genesis.secret')) {
          fs.appendFileSync(gitignorePath, '\n# STREETMP OS Sec\n.genesis.secret\n');
       }
    } else {
       fs.writeFileSync(gitignorePath, '.genesis.secret\n');
    }
    console.log(`[GENESIS] ✅ CONFIG: Locked .gitignore against leakage.\n`);

    await client.query('COMMIT');
    console.log(`[GENESIS] IGNITION SEQUENCE PRIMED. Ready for global uplink.`);

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(`[GENESIS] FATAL FAILURE:`, err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runGenesis();
