/**
 * @file instrument.ts
 * @description Sentry Node.js SDK instrumentation.
 *   MUST be imported before any other module.
 *   Phase 2 — Silent Error Catcher.
 */
import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_DSN_ROUTER;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    release: `router-service@${process.env.npm_package_version ?? "0.1.0"}`,

    // Capture 100% of transactions in dev; throttle in prod via env
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

    // Breadcrumbs for full request context
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],

    beforeSend(event) {
      // Scrub sensitive fields before they leave the process
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["x-api-key"];
        delete event.request.headers["x-vault-token"];
      }
      return event;
    },
  });

  console.log("[Sentry] ✅  Router-Service instrumentation active");
} else {
  console.warn(
    "[Sentry] ⚠️  SENTRY_DSN_ROUTER not set — telemetry disabled. " +
    "Set it in .env to enable error tracking."
  );
}

export { Sentry };
