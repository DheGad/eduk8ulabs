const path = require("path");
const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suppress the "1 Issue" / "0 Issues" dev overlay badge — enterprise builds only
  devIndicators: false,
  // V52: Set tracing root to monorepo root (Docker-safe, no hardcoded paths)
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  output: "standalone",
  generateBuildId: async () => "streetmp-v1",

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ],
      },
    ];
  },
};

// ── [Phase 2] Sentry Integration ────────────────────────────────
// withSentryConfig wraps the build to inject source maps and
// auto-instrument Next.js API routes with error tracking.
module.exports = withSentryConfig(nextConfig, {
  // Suppress source map upload logs during dev
  silent: true,

  // Organisation / project slugs (set via CI/CD secrets or .env)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps only in production
  disableSourceMapUpload: process.env.NODE_ENV !== "production",

  // Automatically wrap API routes without adding manual try/catch
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,

  // Required to avoid build errors when DSN is not set locally
  hideSourceMaps: true,
});
