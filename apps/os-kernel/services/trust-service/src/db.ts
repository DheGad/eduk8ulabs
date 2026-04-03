/**
 * @file db.ts
 * @service trust-service
 * @description PostgreSQL connection pool for the Trust Service.
 *
 * The Trust Service requires READ+WRITE access to:
 *   • execution_traces  — INSERT only (append-only flight recorder)
 *   • hcq_profiles      — INSERT + UPDATE (upsert on each execution)
 *   • users.current_hcq_score — updated indirectly via DB trigger
 *
 * Environment Variables Required:
 *   DB_HOST — PostgreSQL host
 *   DB_PORT — PostgreSQL port (default: 5432)
 *   DB_USER — Database user with access to trust tables
 *   DB_PASS — Database password
 *   DB_NAME — Database name (e.g. "streetmp_os")
 */

import { Pool, PoolConfig } from "pg";

const poolConfig: PoolConfig = {
  host:     process.env.DB_HOST     ?? "localhost",
  port:     parseInt(process.env.DB_PORT ?? "5432", 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max:                  10,
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 5_000,
};

if (!poolConfig.user || !poolConfig.password || !poolConfig.database) {
  throw new Error(
    "[TrustService:db] FATAL: DB_USER, DB_PASS, and DB_NAME environment variables must be set."
  );
}

export const pool = new Pool(poolConfig);

pool.connect((err, _client, release) => {
  if (err) {
    console.error("[TrustService:db] FATAL: Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
  release();
  console.log(
    `[TrustService:db] PostgreSQL pool connected → ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`
  );
});

pool.on("error", (err) => {
  console.error("[TrustService:db] Unexpected pool error:", err.message);
});
