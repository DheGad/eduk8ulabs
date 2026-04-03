/**
 * @file db.ts
 * @service vault-service
 * @description PostgreSQL connection pool for the Vault Service.
 *
 * Uses the `pg` (node-postgres) Pool implementation for connection
 * reuse and automatic management. The pool is initialized once at
 * module load and shared across all request handlers.
 *
 * Environment Variables Required:
 *   DB_HOST  — PostgreSQL host (e.g. "localhost" or RDS endpoint)
 *   DB_PORT  — PostgreSQL port (default: 5432)
 *   DB_USER  — Database user with READ/WRITE on byok_vault
 *   DB_PASS  — Database password
 *   DB_NAME  — Database name (e.g. "streetmp_os")
 */

import { Pool, PoolConfig } from "pg";

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "5432", 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  // Connection pool tuning for a single microservice:
  // Keep idle connections alive to avoid handshake overhead on hot paths.
  max: 10,                  // Maximum concurrent connections (tune per service load)
  idleTimeoutMillis: 30000, // Release idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if DB unreachable — don't hang requests
  // SSL: Enable in production with RDS / managed Postgres.
  // ssl: { rejectUnauthorized: true, ca: fs.readFileSync(process.env.DB_SSL_CA!) }
};

// Validate required config at startup — fail fast before accepting any request
if (!poolConfig.user || !poolConfig.password || !poolConfig.database) {
  throw new Error(
    "[VaultService:db] FATAL: DB_USER, DB_PASS, and DB_NAME environment variables must be set."
  );
}

export const pool = new Pool(poolConfig);

// Verify connectivity on startup and surface config errors immediately
pool.connect((err, client, release) => {
  if (err) {
    console.error("[VaultService:db] FATAL: Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
  release();
  console.log(`[VaultService:db] PostgreSQL pool connected → ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`);
});

// Log pool-level errors (e.g., network interruption on an idle client)
pool.on("error", (err) => {
  console.error("[VaultService:db] Unexpected pool error:", err.message);
});
