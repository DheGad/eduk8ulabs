/**
 * @file services/agentMemory.ts
 * @service router-service
 * @version V79
 * @description Long-Term Agentic Memory State (Persistence)
 */

import { getQueueRedis } from "./agentQueue.js";
import { appendTraceEvent } from "../middleware/traceProvider.js";

const MEMORY_PREFIX = "agent:memory:";

/**
 * Saves a fact into the long-term memory store for the specific user/tenant.
 * Stored as a Redis Hash field to optimize lookup and space.
 */
export async function saveMemory(
  tenantId: string,
  userId: string,
  key: string,
  summary: string,
  traceCtx?: { traceId: string; traceStartedAt: number }
): Promise<boolean> {
  const redis = getQueueRedis();
  if (!redis) {
    console.warn("[V79:Memory] Redis unavailable — cannot save memory.");
    return false;
  }

  const hashKey = `${MEMORY_PREFIX}${tenantId}:${userId}`;

  try {
    // Store in the hash
    await redis.hset(hashKey, key, summary);

    console.info(`[V79:Memory] 💾 Saved memory — tenant=${tenantId} user=${userId} key="${key}"`);

    if (traceCtx?.traceId) {
      appendTraceEvent(traceCtx.traceId, traceCtx.traceStartedAt, "MEMORY_STORED", {
        tenantId,
        userId,
        memoryKey: key,
        summaryLen: summary.length,
      });
    }

    return true;
  } catch (err) {
    console.warn(`[V79:Memory] saveMemory failed: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Retrieves memories for a specific user/tenant.
 * Can query all, or just a specific key.
 */
export async function retrieveMemories(
  tenantId: string,
  userId: string,
  specificKey?: string,
  traceCtx?: { traceId: string; traceStartedAt: number }
): Promise<Record<string, string>> {
  const redis = getQueueRedis();
  if (!redis) return {};

  const hashKey = `${MEMORY_PREFIX}${tenantId}:${userId}`;

  try {
    let result: Record<string, string> = {};

    if (specificKey) {
      // Lookup specific key
      const value = await redis.hget(hashKey, specificKey);
      if (value) {
        result[specificKey] = value;
      }
    } else {
      // Fetch all memories (Redis Hash mapping)
      // Since memory is usually a few strings per user, this is fast enough.
      // If it scales up, this could be clamped to the most recent elements.
      result = await redis.hgetall(hashKey);
    }

    const keyCount = Object.keys(result).length;

    console.info(`[V79:Memory] 🔍 Recalled ${keyCount} memories — tenant=${tenantId} user=${userId}`);

    if (traceCtx?.traceId && keyCount > 0) {
      appendTraceEvent(traceCtx.traceId, traceCtx.traceStartedAt, "MEMORY_RECALLED", {
        tenantId,
        userId,
        query: specificKey ?? "ALL",
        recalledKeys: Object.keys(result),
      });
    }

    return result;
  } catch (err) {
    console.warn(`[V79:Memory] retrieveMemories failed: ${(err as Error).message}`);
    return {};
  }
}

/**
 * Fetches just the keys of stored memories (for prompt injection).
 */
export async function getMemoryKeys(
  tenantId: string,
  userId: string
): Promise<string[]> {
  const redis = getQueueRedis();
  if (!redis) return [];

  const hashKey = `${MEMORY_PREFIX}${tenantId}:${userId}`;
  try {
    return await redis.hkeys(hashKey);
  } catch (err) {
    console.warn(`[V79:Memory] getMemoryKeys failed: ${(err as Error).message}`);
    return [];
  }
}
