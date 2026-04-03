/**
 * @file sentry.client.config.ts
 * @description Sentry browser SDK — Phase 2 Silent Error Catcher.
 *   Loaded automatically by @sentry/nextjs on the client side.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Capture 10% of sessions as replays; 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Capture 20% of performance transactions
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all inputs by default for GDPR compliance
      maskAllInputs: true,
      blockAllMedia: false,
    }),
  ],

  beforeSend(event) {
    // Strip any JWT or API key fragments from request URLs
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/token=[^&]+/, "token=REDACTED");
    }
    return event;
  },

  // StreetMP OS breadcrumb tagging
  initialScope: {
    tags: {
      app: "streetmp-os-web",
      layer: "client",
    },
  },
});
