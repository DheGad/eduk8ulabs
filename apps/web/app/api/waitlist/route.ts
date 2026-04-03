/**
 * @file route.ts
 * @route POST /api/waitlist
 * @description Waitlist email capture API route.
 *
 * Stores submitted emails in Postgres (waitlist_signups table).
 * Falls back to a JSON log file if DB is unavailable (dev mode).
 *
 * Table schema (append to packages/database/schema.sql if not present):
 *   CREATE TABLE IF NOT EXISTS waitlist_signups (
 *     id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     email      TEXT NOT NULL UNIQUE,
 *     role       TEXT,            -- 'client' | 'engineer' | 'enterprise'
 *     company    TEXT,
 *     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

interface WaitlistPayload {
  email:    string;
  role?:    string;
  company?: string;
}

// ── In-memory fallback store (dev / no DB) ───────────────────────
const DEV_STORE: WaitlistPayload[] = [];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const waitlistSchema = z.object({
    email: z.string().min(1, "Email is required.").email("Invalid email format."),
    role: z.string().optional(),
    company: z.string().optional(),
  });

  let parsedBody;
  try {
    parsedBody = waitlistSchema.parse(await req.json());
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 422 });
    }
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { email, role, company } = parsedBody;

  const clean = { email: email.toLowerCase().trim(), role, company };

  // ── Try Postgres ──────────────────────────────────────────────
  const pgUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (pgUrl) {
    try {
      // Dynamic import so the route still compiles without pg installed
      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: pgUrl });

      await pool.query(
        `INSERT INTO waitlist_signups (email, role, company)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [clean.email, clean.role ?? null, clean.company ?? null]
      );
      await pool.end();

      return NextResponse.json(
        { success: true, message: "You're on the list. We'll be in touch." },
        { status: 201 }
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "23505") {
        // Unique constraint — already signed up
        return NextResponse.json(
          { success: true, message: "You're already on the waitlist." },
          { status: 200 }
        );
      }
      console.error("[waitlist] Postgres error:", err);
      // Fall through to in-memory store
    }
  }

  // ── Dev fallback: in-memory / log ────────────────────────────
  if (DEV_STORE.some((e) => e.email === clean.email)) {
    return NextResponse.json(
      { success: true, message: "You're already on the waitlist." },
      { status: 200 }
    );
  }
  DEV_STORE.push(clean);
  console.info("[waitlist] DEV signup:", clean);

  return NextResponse.json(
    { success: true, message: "You're on the list. We'll be in touch." },
    { status: 201 }
  );
}

// Only POST allowed
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
