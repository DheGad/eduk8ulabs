/**
 * @file jest.security.config.mjs
 * @description Jest configuration for the Phase 7 Security Penetration Test Suite.
 *
 * Uses ts-jest for TypeScript transformation. The test runner targets only
 * the security/ subdirectory so it doesn't accidentally pull in the existing
 * manual e2e_matrix and chaos test files.
 *
 * IMPORTANT: Run with:
 *   npm run test:security                  # from apps/os-kernel/services/router-service
 *   SKIP_LIVE_TESTS=true npm run test:security  # offline-only (no router service needed)
 */

export default {
  preset:      "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module:       "ESNext",
          moduleResolution: "Bundler",
          target:       "ES2022",
          esModuleInterop: true,
          allowImportingTsExtensions: false,
          strict:       true,
        },
      },
    ],
  },
  // Target the security tests in the os-kernel tests directory
  // The test file is at: apps/os-kernel/tests/security/tenant-isolation.test.ts
  testMatch: [
    "**/../../../tests/security/**/*.test.ts",
    "**/apps/os-kernel/tests/security/**/*.test.ts",
  ],
  rootDir: "../../../..",
  // Timeout per test — rate-limit burst may take 60s+
  testTimeout: 90_000,
  // Verbose output for security audit log
  verbose: true,
  // Force exit after all tests (closes any open keep-alive connections from supertest)
  forceExit: true,
};
