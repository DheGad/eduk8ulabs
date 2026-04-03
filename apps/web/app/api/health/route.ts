import { NextResponse } from "next/server";
import { Pool } from "pg";

// Lightweight pool — single connection, short timeout
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 5000,
});

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    // Lightweight liveness probe — no table scan, no PII
    await pool.query("SELECT 1");

    return NextResponse.json(
      {
        status: "Sovereign OS Operational",
        db: "Connected",
        timestamp,
      },
      {
        status: 200,
        headers: {
          // Public for uptime monitors, no-store prevents caching stale status
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Robots-Tag": "noindex",
        },
      }
    );
  } catch (err) {
    // Never expose DB URL, connection strings, or stack traces
    console.error("[HealthCheck] DB probe failed:", err);

    return NextResponse.json(
      {
        status: "Degraded",
        db: "Unreachable",
        timestamp,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
