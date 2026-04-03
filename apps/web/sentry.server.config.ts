/**
 * @file sentry.server.config.ts
 * @description Sentry server SDK (Node.js runtime) for Next.js API routes.
 *   Loaded automatically by @sentry/nextjs on the server side.
 *   Phase 2 — Silent Error Catcher.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  beforeSend(event) {
    // Scrub auth headers from server-side captures
    if (event.request?.headers) {
      delete (event.request.headers as Record<string, unknown>)["authorization"];
      delete (event.request.headers as Record<string, unknown>)["x-api-key"];
      delete (event.request.headers as Record<string, unknown>)["cookie"];
    }
    return event;
  },

  initialScope: {
    tags: {
      app: "streetmp-os-web",
      layer: "server",
    },
  },
});
