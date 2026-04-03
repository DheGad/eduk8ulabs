/**
 * @file db.ts
 * @service auth-service
 * @description PostgreSQL connection pool for the Auth Service.
 *
 * The Auth Service requires READ/WRITE on the `users` table only.
 * In production, provision a dedicated DB user:
 *   GRANT SELECT, INSERT ON users TO auth_svc_user;
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
    "[AuthService:db] FATAL: DB_USER, DB_PASS, and DB_NAME must be set."
  );
}

export const pool = new Pool(poolConfig);

pool.connect((err, _client, release) => {
  if (err) {
    console.error("[AuthService:db] FATAL: PostgreSQL connection failed:", err.message);
    process.exit(1);
  }
  release();
  console.log(
    `[AuthService:db] PostgreSQL pool connected → ${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`
  );
});

pool.on("error", (err) => {
  console.error("[AuthService:db] Unexpected pool error:", err.message);
});
