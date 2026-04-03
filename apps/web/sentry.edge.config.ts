/**
 * @file sentry.edge.config.ts
 * @description Sentry Edge runtime config (used by Next.js middleware).
 *   Phase 2 — Silent Error Catcher.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  initialScope: {
    tags: {
      app: "streetmp-os-web",
      layer: "edge",
    },
  },
});
