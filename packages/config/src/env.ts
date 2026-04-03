/**
 * @file env.ts
 * @package @streetmp-os/config
 * @description Monorepo root .env loader.
 *
 * ================================================================
 * THE MASTER .ENV STRATEGY
 * ================================================================
 *
 * Problem: A monorepo with 5 microservices cannot maintain 5 
 * separate .env files without risking drift (e.g., updating 
 * JWT_SECRET in one place but not another).
 *
 * Solution: A single root .env file. Each service calls this
 * utility BEFORE any other import so the root .env is loaded
 * into process.env regardless of which directory the service
 * is started from.
 *
 * How it works:
 *   1. Starts from the current file's directory
 *   2. Walks up the directory tree until it finds a file
 *      named ".env" at the monorepo root (identified by the
 *      presence of "turbo.json")
 *   3. Loads that file with dotenv
 *   4. Falls back gracefully if .env doesn't exist
 *      (CI/CD systems inject env vars directly)
 *
 * Usage in any service index.ts:
 *   import "@streetmp-os/config/env";    // <- FIRST LINE
 *   import express from "express";
 *   // ... rest of imports
 * ================================================================
 */

import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function findMonorepoRoot(startDir: string): string | null {
  let current = startDir;
  // Walk up at most 10 levels to find the monorepo root
  for (let i = 0; i < 10; i++) {
    // Monorepo root is identified by the presence of turbo.json
    if (existsSync(join(current, "turbo.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }
  return null;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = findMonorepoRoot(__dirname);

if (monorepoRoot) {
  const envPath = join(monorepoRoot, ".env");
  if (existsSync(envPath)) {
    config({ path: envPath });
    console.log(`[Config] ✅ Loaded root .env from ${envPath}`);
  } else {
    // .env doesn't exist — CI/CD injects env vars directly
    // This is expected in production. Do not error.
    console.log(`[Config] ℹ️  No .env file found at ${envPath} — using process.env directly`);
  }
} else {
  console.warn("[Config] ⚠️  Could not locate monorepo root (turbo.json not found in parent directories)");
}
