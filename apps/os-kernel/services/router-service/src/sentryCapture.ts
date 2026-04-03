/**
 * @file sentryCapture.ts
 * @description Thin Sentry capture helper for the router-service.
 *   Wraps Sentry.captureException with router-service context so
 *   every critical catch block has a single, consistent call site.
 *
 *   Phase 2 — Silent Error Catcher
 *
 * Usage:
 *   import { captureRouterError } from "./sentryCapture.js";
 *   ...
 *   } catch (err) {
 *     captureRouterError(err, { route: "/api/v1/execute", traceId });
 *     res.status(500).json({ ... });
 *   }
 */

import { Sentry } from "./instrument.js";

interface RouterErrorContext {
  /** The express route that threw (e.g. "/api/v1/execute") */
  route?: string;
  /** HTTP method of the originating request */
  method?: string;
  /** V70 trace ID threaded through the request */
  traceId?: string | null;
  /** Arbitrary extra key/value metadata */
  extra?: Record<string, unknown>;
  /** Sentry tags to attach */
  tags?: Record<string, string>;
}

/**
 * Capture an exception in Sentry with router-service context.
 * This call is intentionally non-throwing — a Sentry failure
 * must NEVER propagate to the caller or disrupt routing.
 */
export function captureRouterError(
  err: unknown,
  ctx: RouterErrorContext = {}
): void {
  try {
    Sentry.captureException(err, {
      tags: {
        service: "router-service",
        route:   ctx.route   ?? "unknown",
        method:  ctx.method  ?? "unknown",
        ...ctx.tags,
      },
      extra: {
        traceId: ctx.traceId ?? null,
        ...ctx.extra,
      },
    });
  } catch {
    // Non-fatal: log to stderr only
    console.error("[Sentry:captureRouterError] Failed to capture exception:", err);
  }
}
