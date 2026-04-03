/**
 * @file traceProvider.ts
 * @service router-service
 * @version V70
 * @description Correlation Trace Engine — Request-Scoped Trace ID Middleware
 *
 * Assigns a unique x-streetmp-trace-id to every incoming request.
 * The ID is:
 *   • Injected into req.traceId (typed via Express augmentation)
 *   • Written to x-streetmp-trace-id response header immediately
 *   • Propagated into Redis (non-blocking) as the Active Trace buffer
 *
 * PERFORMANCE CONTRACT:
 *   Redis writes are fire-and-forget — they NEVER block the Express
 *   middleware chain. A Redis failure is logged but swallowed silently.
 *
 * TRACE TIMELINE EVENTS are appended to a Redis list:
 *   Key: trace:{traceId}:events
 *   TTL: 24 hours (active trace buffer)
 *   Each event: JSON with { t, label, meta? }
 *
 * V70 integration points:
 *   Middleware: added to index.ts (before all routes)
 *   Propagation: routes.ts, dlpEngine, alertEngine, merkleLogger
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { Redis, type RedisOptions } from "ioredis";

// ----------------------------------------------------------------
// REDIS CLIENT (lazy singleton, fail-open)
// ----------------------------------------------------------------

let traceRedis: Redis | null = null;

function getTraceRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (traceRedis) return traceRedis;

  try {
    traceRedis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 1500,
      lazyConnect: false,
      enableOfflineQueue: false,
    } satisfies RedisOptions);

    traceRedis.on("error", (err: Error) => {
      // Non-fatal — trace store unavailable degrades gracefully
      console.debug(`[V70:Trace] Redis error (non-fatal): ${err.message}`);
    });
    traceRedis.on("close", () => { traceRedis = null; });
  } catch {
    return null;
  }

  return traceRedis;
}

// ----------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------

export interface TraceEvent {
  /** Milliseconds since trace creation */
  t:      number;
  /** Human-readable label, e.g. "DLP_SCRUBBED" */
  label:  string;
  /** Optional structured metadata */
  meta?:  Record<string, unknown>;
}

/** TTL for the Active Trace buffer in Redis (24 h) */
const TRACE_TTL_SECONDS = 24 * 60 * 60;

// ----------------------------------------------------------------
// CORE HELPERS (exported for use in other V-series modules)
// ----------------------------------------------------------------

/**
 * Appends a timed event to the running trace timeline (fire-and-forget).
 * Call this from any V-series module — DLP, Quota, Alert, etc.
 *
 * @param traceId - The x-streetmp-trace-id for this request
 * @param label   - Short event label (e.g. "DLP_CUSTOM_RULES_FIRED")
 * @param meta    - Optional structured context
 */
export function appendTraceEvent(
  traceId:   string,
  startedAt: number,
  label:     string,
  meta?:     Record<string, unknown>
): void {
  const redis = getTraceRedis();
  if (!redis) return;

  const event: TraceEvent = {
    t:     Date.now() - startedAt,
    label,
    meta,
  };

  const key = `trace:${traceId}:events`;

  // RPUSH + EXPIRE — both are fire-and-forget
  Promise.resolve()
    .then(() => redis.rpush(key, JSON.stringify(event)))
    .then(() => redis.expire(key, TRACE_TTL_SECONDS))
    .catch((err: unknown) => {
      console.debug(`[V70:Trace] Event push failed (non-fatal): ${(err as Error)?.message}`);
    });
}

/**
 * Persists trace metadata (tenant, model, region etc.) to Redis hash.
 * Called once per request with the resolved execution context.
 */
export function setTraceMeta(
  traceId: string,
  meta: Record<string, string | number | boolean>
): void {
  const redis = getTraceRedis();
  if (!redis) return;

  const key = `trace:${traceId}:meta`;

  Promise.resolve()
    .then(() => redis.hset(key, { ...meta, traceId }))
    .then(() => redis.expire(key, TRACE_TTL_SECONDS))
    .catch((err: unknown) => {
      console.debug(`[V70:Trace] Meta write failed (non-fatal): ${(err as Error)?.message}`);
    });
}

/**
 * Reads a full trace timeline from Redis — used by the Trace Lookup API.
 *
 * @returns { meta, events } or null if traceId is unknown / expired
 */
export async function getTraceFromRedis(traceId: string): Promise<{
  meta:   Record<string, string>;
  events: TraceEvent[];
} | null> {
  const redis = getTraceRedis();
  if (!redis) return null;

  try {
    const [metaRaw, eventsRaw] = await Promise.all([
      redis.hgetall(`trace:${traceId}:meta`),
      redis.lrange(`trace:${traceId}:events`, 0, -1),
    ]);

    if (!metaRaw || Object.keys(metaRaw).length === 0) return null;

    const events: TraceEvent[] = eventsRaw.map((e) => JSON.parse(e) as TraceEvent);
    return { meta: metaRaw, events };
  } catch (err: unknown) {
    console.warn(`[V70:Trace] Lookup failed: ${(err as Error)?.message}`);
    return null;
  }
}

// ----------------------------------------------------------------
// EXPRESS MIDDLEWARE
// ----------------------------------------------------------------

/**
 * V70 Trace Provider Middleware.
 * Must be mounted BEFORE all route handlers in index.ts.
 *
 * Generates a UUID trace ID, attaches it to the request (req.traceId)
 * and the response headers, then records the REQUEST_RECEIVED event.
 */
export function traceProviderMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const traceId  = randomUUID();
  const startedAt = Date.now();

  // Attach to request object for downstream propagation
  req.traceId   = traceId;
  req.traceStartedAt = startedAt;

  // Surface in response headers — visible in browser DevTools + cURL
  res.setHeader("x-streetmp-trace-id", traceId);

  // Seed the first event in the timeline
  appendTraceEvent(traceId, startedAt, "REQUEST_RECEIVED", {
    method: req.method,
    path:   req.path,
    ip:     req.ip,
  });

  // On response close: append RESPONSE_SENT event
  res.on("finish", () => {
    appendTraceEvent(traceId, startedAt, "RESPONSE_SENT", {
      status: res.statusCode,
      total_ms: Date.now() - startedAt,
    });
  });

  next();
}

// ----------------------------------------------------------------
// GRACEFUL SHUTDOWN
// ----------------------------------------------------------------

export async function closeTraceConnection(): Promise<void> {
  if (traceRedis) {
    await traceRedis.quit();
    traceRedis = null;
  }
}
