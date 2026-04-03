/**
 * @file health.ts
 * @package api-gateway
 * @description Health & Status check endpoints (C045 Task 6)
 *
 * Provides deep health inspections. Ensures the application ONLY
 * reports "healthy" to Docker or Kubernetes if the entire OS
 * dependency chain (Postgres, Redis) is accessible.
 */

import { Router, Request, Response } from "express";
import { Pool } from "pg";
import Redis from "ioredis";

export const healthRouter = Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://streetmp:streetmp_pass@localhost:5432/streetmp_os",
  max: 2,
  idleTimeoutMillis: 3000
});

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 1,
  connectTimeout: 2000
});
redis.on('error', () => { /* Prevent crash on boot wait */ });

/**
 * GET /api/v1/health
 * A fast, unauthenticated ping. Kubernetes liveness probe.
 */
healthRouter.get("/health", (req: Request, res: Response) => {
  res.status(200).send("OK");
});

/**
 * GET /api/v1/status
 * Deep dependency check. Kubernetes readiness probe.
 */
healthRouter.get("/status", async (req: Request, res: Response) => {
  const startMs = Date.now();
  const status = {
    service: "streetmp_os_gateway",
    postgres: "disconnected",
    redis: "disconnected",
    uptime_seconds: Math.floor(process.uptime()),
    latency_ms: 0
  };

  try {
    // 1. Probe Postgres
    const pgRes = await pool.query("SELECT 1 as ok");
    if (pgRes.rows[0].ok === 1) {
      status.postgres = "connected";
    }

    // 2. Probe Redis
    const redisRes = await redis.ping();
    if (redisRes === "PONG") {
      status.redis = "connected";
    }

    status.latency_ms = Date.now() - startMs;

    // Fail readiness if dependencies are down
    if (status.postgres !== "connected" || status.redis !== "connected") {
      res.status(503).json({ error: "DEGRADED_DEPENDENCY", ...status });
      return;
    }

    res.status(200).json(status);
  } catch (err: any) {
    status.latency_ms = Date.now() - startMs;
    res.status(503).json({ error: "SERVICE_UNAVAILABLE", message: err.message, ...status });
  }
});
