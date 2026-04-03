/**
 * @file cache.ts
 * @package memory-service
 * @description Smart Caching Layer
 *
 * Implements C045 Task 3.
 * Caches successful identical executions in Redis to reduce latency to ~5ms 
 * and drop provider costs to $0 for repeatable LLM workflows.
 */

import { Router, Request, Response } from "express";
import { Redis } from "ioredis";

export const cacheRouter = Router();

// @ts-ignore
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// For tracking cache hit ratios via /api/v1/cache/stats
let memoryStats = {
  hits: 0,
  misses: 0,
  sets: 0
};

/**
 * Helper to generate deterministic cache keys
 */
export const generateCacheKey = (provider: string, model: string, prompt: string, schemaHash: string = "no-schema") => {
  // @ts-ignore
  return `llm_cache:${provider}:${model}:${schemaHash}:${Bun.hash(prompt).toString(16)}`; // Simplified hash representation
};

/**
 * Route: GET /api/v1/cache/stats
 * Displays the core caching engine's real-time hit ratio.
 */
cacheRouter.get("/cache/stats", async (req: Request, res: Response) => {
  try {
    const totalRequests = memoryStats.hits + memoryStats.misses;
    const hitRatio = totalRequests > 0 ? (memoryStats.hits / totalRequests) * 100 : 0;
    
    // Check Redis memory consumption real-time
    const info = await redis.info("memory");
    const usedMemoryHuman = info.split("\n").find((line: string) => line.startsWith("used_memory_human:"))?.split(":")[1]?.trim() || "0B";

    res.status(200).json({
      success: true,
      stats: {
        total_queries: totalRequests,
        cache_hits: memoryStats.hits,
        cache_misses: memoryStats.misses,
        items_cached: memoryStats.sets,
        hit_ratio_percentage: Number(hitRatio.toFixed(2)),
      },
      redis: {
        status: redis.status,
        used_memory: usedMemoryHuman
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "CACHE_STATS_UNAVAILABLE" });
  }
});

// Assuming internal memory routes for Router or Enforcer to /cache/get and /cache/set
cacheRouter.post("/cache/get", async (req: Request, res: Response) => {
  const { provider, model, prompt, schema_hash } = req.body;
  if (!prompt || !model) { res.status(400).send(); return; }

  const key = generateCacheKey(provider, model, prompt, schema_hash);
  try {
    const cached = await redis.get(key);
    if (cached) {
      memoryStats.hits++;
      res.json({ hit: true, output: cached });
    } else {
      memoryStats.misses++;
      res.json({ hit: false });
    }
  } catch {
    memoryStats.misses++;
    res.json({ hit: false }); // Degrade gracefully on Redis fail
  }
});

cacheRouter.post("/cache/set", async (req: Request, res: Response) => {
  const { provider, model, prompt, schema_hash, output, ttl_seconds } = req.body;
  if (!output || !prompt) { res.status(400).send(); return; }

  const key = generateCacheKey(provider, model, prompt, schema_hash);
  try {
    // Cache successful execution for TTL (default 1 hour)
    await redis.set(key, output, "EX", ttl_seconds || 3600);
    memoryStats.sets++;
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false }); // Fails gracefully
  }
});
