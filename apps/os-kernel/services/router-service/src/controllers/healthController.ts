/**
 * @file controllers/healthController.ts
 * @service router-service
 * @phase Phase 7 — Titan 3.0 Sidecar
 * @description
 *   Provides Infra Pulse metrics for the Titan HQ Sidecar.
 */

import { Request, Response } from "express";
import { pool } from "../db.js";
import { getSharedRedisClient } from "../redisClient.js";
import os from "os";

export async function getInfraPulse(req: Request, res: Response) {
  try {
    // 1. CPU
    const cpus = os.cpus();
    const cpuModel = cpus[0].model;
    const coreCount = cpus.length;
    // Simple load average approximation 1 minute
    const loadAvg = os.loadavg()[0]; 
    const cpuUsagePct = Math.min((loadAvg / coreCount) * 100, 100).toFixed(1);

    // 2. RAM
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePct = ((usedMem / totalMem) * 100).toFixed(1);

    // 3. Redis
    let redisLatencyMs = -1;
    let redisStatus = "OFFLINE";
    const redis = getSharedRedisClient();
    if (redis) {
      const start = Date.now();
      try {
         await redis.ping();
         redisLatencyMs = Date.now() - start;
         redisStatus = "ONLINE";
      } catch (e) {
         redisStatus = "ERROR";
      }
    }

    // 4. DB Pool (pg doesn't easily expose exact active connections via simple properties in standard Pool, 
    // but we can query pg_stat_activity safely)
    let activeDbConnections = 0;
    try {
      const dbRes = await pool.query("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'");
      activeDbConnections = parseInt(dbRes.rows[0].count, 10);
    } catch {
      // ignore
    }

    res.json({
      success: true,
      data: {
        cpu: { model: cpuModel, cores: coreCount, usagePct: parseFloat(cpuUsagePct) },
        ram: { totalGb: (totalMem / 1024 / 1024 / 1024).toFixed(2), usedGb: (usedMem / 1024 / 1024 / 1024).toFixed(2), usagePct: parseFloat(memUsagePct) },
        redis: { status: redisStatus, latencyMs: redisLatencyMs },
        database: { activeConnections: activeDbConnections }
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: "Health check failed" });
  }
}
