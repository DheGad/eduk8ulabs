/**
 * @file db.ts
 * @service router-service
 * @description PostgreSQL connection pool for the Sovereignty endpoints.
 *
 * The sovereignty endpoints (shard custody, HYOK KMS registry, revocation log)
 * write directly to the shared database rather than going through the
 * vault-service, since they manage tables that don't exist in the vault-service.
 *
 * Environment variables (same as vault-service — shared DB):
 *   DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 */
import { Pool } from "pg";
const poolConfig = {
    host: process.env.DB_HOST ?? "localhost",
    port: parseInt(process.env.DB_PORT ?? "5432", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    max: 5, // Smaller pool — sovereignty endpoints are low-traffic
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
};
// Graceful startup — pool is lazy by default; connect() is called manually only in
// vault-service for the startup probe. Here we skip the probe to avoid duplicate
// "connected" logs and let the first query surface any config issues.
export const pool = new Pool(poolConfig);
pool.on("error", (err) => {
    console.error("[RouterService:db] Unexpected pool error:", err.message);
});
