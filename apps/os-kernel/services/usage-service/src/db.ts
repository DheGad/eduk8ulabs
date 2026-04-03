/**
 * @file db.ts
 * @service usage-service
 * @description PostgreSQL connection pool for the Usage Service.
 *
 * Mirrors the vault-service db.ts pattern:
 *   - Fail-fast configuration validation at module load
 *   - Startup connectivity probe (exits process on failure)
 *   - Pool-level error logging for unexpected disconnections
 *
 * The Usage Service needs READ/WRITE on the `usage_logs` table only.
 * In production, create a dedicated DB user with minimal privileges:
 *   GRANT INSERT, SELECT ON usage_logs TO usage_svc_user;
 */

import { Pool, PoolConfig } from "pg";

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (!poolConfig.user || !poolConfig.password || !poolConfig.database) {
  throw new Error(
    "[UsageService:db] FATAL: DB_USER, DB_PASS, and DB_NAME must be set."
  );
}

export const pool = new Pool(poolConfig);

pool.connect((err, _client, release) => {
  if (err) {
    console.error("[UsageService:db] FATAL: PostgreSQL connection failed:", err.message);
    process.exit(1);
  }
  release();
  console.log(
    `[UsageService:db] PostgreSQL pool connected → ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`
  );
});

pool.on("error", (err) => {
  console.error("[UsageService:db] Unexpected pool error:", err.message);
});
