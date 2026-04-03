/**
 * @file index.ts
 * @package @streetmp-os/logger
 * @description Sentinel — Shared structured logger for all StreetMP OS microservices.
 *
 * Features:
 *   • Pino-based JSON logging (production) / pretty-print (development)
 *   • Mandatory context fields: service_name, request_id, user_id, trace_id
 *   • Child logger factory for per-request tracing across microservices
 *   • Log-level driven by LOG_LEVEL env var (default: "info")
 *   • OpenTelemetry-compatible trace_id / span_id fields for future integration
 *
 * Usage in any microservice:
 *   import { createLogger, createRequestLogger } from "@streetmp-os/logger";
 *
 *   // 1. Module-level logger (service boot, DB connections, background tasks)
 *   const log = createLogger("enforcer-service");
 *   log.info({ event: "boot" }, "Enforcer Service starting on port 4001");
 *
 *   // 2. Request-scoped logger (one per inbound HTTP request)
 *   app.use((req, _res, next) => {
 *     req.log = createRequestLogger("enforcer-service", {
 *       request_id: req.headers["x-request-id"] as string ?? crypto.randomUUID(),
 *       user_id:    req.user?.id,
 *       trace_id:   req.headers["x-trace-id"] as string ?? crypto.randomUUID(),
 *     });
 *     next();
 *   });
 */

import pino, { type Logger, type LoggerOptions } from "pino";

// ================================================================
// TYPES
// ================================================================

export interface RequestContext {
  /** Unique ID for the inbound HTTP request — propagated across services */
  request_id: string;
  /** Authenticated user initiating the request */
  user_id?:   string;
  /**
   * Distributed trace ID — set at the entry point (Router/Enforcer),
   * forwarded as the X-Trace-ID header to all downstream services.
   * This is the key that lets you reconstruct a full execution graph
   * from Policy → Memory → Enforcer → Usage → Trust in one query.
   */
  trace_id?:  string;
  /** OpenTelemetry span ID (future integration) */
  span_id?:   string;
}

export interface ServiceLoggerOptions {
  /** Human-readable service name, e.g. "enforcer-service" */
  serviceName: string;
  /** Override log level. Defaults to LOG_LEVEL env var, then "info" */
  level?: string;
  /** Extra static fields added to every log line from this service */
  extra?: Record<string, unknown>;
}

// ================================================================
// LOG LEVELS
// ================================================================
const VALID_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
type Level = typeof VALID_LEVELS[number];

function resolveLevel(): Level {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  return VALID_LEVELS.includes(env as Level) ? (env as Level) : "info";
}

// ================================================================
// PINO BASE CONFIG
// ================================================================
function buildOptions(
  serviceName: string,
  level: Level,
  extra?: Record<string, unknown>
): LoggerOptions {
  const isDev = process.env.NODE_ENV !== "production";

  return {
    level,
    // Static fields present on every log line
    base: {
      service_name: serviceName,
      env:          process.env.NODE_ENV ?? "development",
      version:      process.env.npm_package_version ?? "0.0.0",
      ...extra,
    },
    // ISO timestamp → enables direct ingestion by Loki / Datadog / Cloud Logging
    timestamp: pino.stdTimeFunctions.isoTime,
    // Rename "msg" → "message" for compatibility with standard logging schemas
    messageKey: "message",
    // Pretty-print in dev; structured JSON in production
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize:        true,
            translateTime:   "SYS:HH:MM:ss",
            ignore:          "pid,hostname,env,version",
            messageFormat:   "{service_name} | {message}",
          },
        }
      : undefined,
    // Redact secrets that should never appear in logs
    redact: {
      paths: [
        "*.password",
        "*.api_key",
        "*.secret",
        "*.authorization",
        "*.stripe_secret_key",
        "*.token",
        "body.password",
        'req.headers["authorization"]',
      ],
      censor: "[REDACTED]",
    },
    // Error serializer — captures stack traces
    serializers: {
      err:   pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req:   pino.stdSerializers.req,
      res:   pino.stdSerializers.res,
    },
  };
}

// ================================================================
// PUBLIC API
// ================================================================

/**
 * Creates a module-level (service-scoped) logger.
 * Use this for service boot events, background tasks, and non-request logs.
 *
 * @example
 *   const log = createLogger("memory-service");
 *   log.info("Memory service boot complete");
 *   log.warn({ schema_hash: "abc123" }, "Schema not found in memory — cold start");
 *   log.error({ err }, "Failed to connect to Postgres");
 */
export function createLogger(
  serviceName: string,
  options?: Partial<ServiceLoggerOptions>
): Logger {
  const level = options?.level
    ? (options.level as Level)
    : resolveLevel();

  return pino(buildOptions(
    options?.serviceName ?? serviceName,
    level,
    options?.extra
  ));
}

/**
 * Creates a request-scoped child logger.
 * The returned logger carries request_id, user_id, and trace_id on every line
 * it emits — making it trivial to reconstruct a full cross-service trace.
 *
 * Forward X-Trace-ID and X-Request-ID headers to every downstream HTTP call
 * to maintain the trace context end-to-end.
 *
 * @example
 *   app.use((req, _res, next) => {
 *     req.log = createRequestLogger("enforcer-service", {
 *       request_id: req.headers["x-request-id"] ?? crypto.randomUUID(),
 *       trace_id:   req.headers["x-trace-id"]   ?? crypto.randomUUID(),
 *       user_id:    req.user?.id,
 *     });
 *     next();
 *   });
 */
export function createRequestLogger(
  serviceName: string,
  context: RequestContext,
  options?: Partial<ServiceLoggerOptions>
): Logger {
  const base = createLogger(serviceName, options);
  return base.child({
    request_id: context.request_id,
    user_id:    context.user_id   ?? null,
    trace_id:   context.trace_id  ?? null,
    span_id:    context.span_id   ?? null,
  });
}

// ================================================================
// EXPRESS MIDDLEWARE HELPER
// ================================================================

/**
 * Express middleware factory.
 * Attaches a request-scoped logger to req.log and logs every inbound request.
 *
 * @example
 *   import { requestLoggerMiddleware } from "@streetmp-os/logger";
 *   app.use(requestLoggerMiddleware("router-service"));
 */
export function requestLoggerMiddleware(serviceName: string) {
  return (req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
    const rid = (req["headers"] as Record<string, string>)?.["x-request-id"]
      ?? crypto.randomUUID();
    const tid = (req["headers"] as Record<string, string>)?.["x-trace-id"]
      ?? crypto.randomUUID();
    const uid = (req["user"] as { id?: string } | undefined)?.id;

    req["log"] = createRequestLogger(serviceName, {
      request_id: rid,
      trace_id:   tid,
      user_id:    uid,
    });

    // Propagate trace context to downstream calls via headers
    req["traceHeaders"] = {
      "x-request-id": rid,
      "x-trace-id":   tid,
    };

    (req["log"] as Logger).info(
      { method: req["method"], url: req["url"] },
      "→ inbound request"
    );
    next();
  };
}

// ================================================================
// PROMETHEUS METRICS HELPER
// ================================================================

/**
 * Standard metric labels added to every Prometheus counter/histogram.
 * Import this alongside prom-client in individual microservices.
 *
 * @example
 *   import { METRIC_LABELS } from "@streetmp-os/logger";
 *   import { Counter } from "prom-client";
 *   const requestCounter = new Counter({
 *     name: "http_requests_total",
 *     help: "Total HTTP requests",
 *     labelNames: [...METRIC_LABELS, "status_code"],
 *   });
 */
export const METRIC_LABELS = ["service_name", "method", "route"] as const;

export type MetricLabelValues = Record<typeof METRIC_LABELS[number], string>;

// ================================================================
// DEPLOYMENT READINESS: GRACEFUL SHUTDOWN (TASK 10)
// ================================================================

import type { Server } from "http";

/**
 * Attaches SIGTERM and SIGINT handlers to the process to elegantly close OS services.
 * Implements C045 Task 10: Graceful Shutdown.
 * 
 * @param server The HTTP server instance to close
 * @param serviceName Name of the service for logging
 * @param customCleanup Optional async function to close DB/Redis pools
 */
export function gracefulShutdown(server: Server, serviceName: string, customCleanup?: () => Promise<void>) {
  const log = createLogger(serviceName);
  
  const shutdown = async (signal: string) => {
    log.info({ signal }, `[${serviceName}] Received ${signal}. Initiating graceful shutdown...`);
    
    server.close(async (err) => {
      if (err) {
        log.error({ err }, "Error closing HTTP server.");
        process.exit(1);
      }
      log.info(`[${serviceName}] HTTP server closed.`);

      if (customCleanup) {
        try {
          await customCleanup();
          log.info(`[${serviceName}] Connected resources released successfully.`);
        } catch (cleanupErr) {
          log.error({ err: cleanupErr }, `[${serviceName}] Error during resource cleanup.`);
        }
      }
      
      log.info(`[${serviceName}] Shutdown complete. Exiting cleanly (0).`);
      process.exit(0);
    });

    // Failsafe exit if server connections dangle for > 10 seconds
    setTimeout(() => {
      log.fatal(`[${serviceName}] Graceful shutdown timed out (10s). Forcing termination.`);
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
