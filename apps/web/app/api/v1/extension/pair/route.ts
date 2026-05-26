/**
 * @file app/api/v1/extension/pair/route.ts
 * @route POST /api/v1/extension/pair  — Generate a pairing token
 * @route GET  /api/v1/extension/pair  — Poll pairing status
 *
 * Security model:
 *  - POST generates a cryptographically random 6-char token, stored in-memory
 *    with a 5-minute TTL. In production, this should be stored in Redis.
 *  - GET polls whether the token has been claimed by the extension.
 *  - The extension submits the token via its popup; the server marks it claimed.
 *  - Token auto-expires after TOKEN_TTL_MS to prevent replay attacks.
 *
 * Note: For MVP this uses an in-process Map as the token store.
 * When Redis is available, replace the Map with a Redis SET with EX TTL.
 *
 * PRODUCTION UPGRADE PATH:
 *   await redis.set(`ext:pair:${token}`, orgId, { ex: 300 });
 *   const claimed = await redis.get(`ext:pair:claimed:${token}`);
 */

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── In-process token store (upgrade to Redis for multi-instance deployments) ──
interface PairEntry {
  orgId:   string;
  userId:  string;
  claimed: boolean;
  expires: number;
}

// Module-level map — survives across requests in the same Node.js process.
// On PM2 cluster mode, each worker has its own map — use Redis for multi-instance.
const pairTokens = new Map<string, PairEntry>();

// Clean up expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of pairTokens) {
    if (entry.expires < now) pairTokens.delete(token);
  }
}, 10 * 60 * 1000);

function generateToken(): string {
  // 6 uppercase alphanumeric chars — easy to type in extension popup
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[b % 36])
    .join("");
}

// ── POST /api/v1/extension/pair — Generate a new pairing token ───────────────
export async function POST(req: NextRequest) {
  const jwtToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!jwtToken?.id) {
    return NextResponse.json(
      { error: "Unauthorized — sign in first" },
      { status: 401 }
    );
  }

  const token = generateToken();
  pairTokens.set(token, {
    orgId:   (jwtToken.org_id as string) ?? "",
    userId:  jwtToken.id as string,
    claimed: false,
    expires: Date.now() + TOKEN_TTL_MS,
  });

  return NextResponse.json({
    token,
    expires_in_seconds: TOKEN_TTL_MS / 1000,
  });
}

// ── GET /api/v1/extension/pair?token=TOKEN — Poll claim status ───────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.toUpperCase();

  if (!token) {
    return NextResponse.json({ error: "Missing token parameter" }, { status: 400 });
  }

  const entry = pairTokens.get(token);

  if (!entry) {
    return NextResponse.json({ status: "not_found" }, { status: 404 });
  }

  if (entry.expires < Date.now()) {
    pairTokens.delete(token);
    return NextResponse.json({ status: "expired" }, { status: 410 });
  }

  if (entry.claimed) {
    // Delete after confirming — single-use token
    pairTokens.delete(token);
    return NextResponse.json({
      status:  "paired",
      org_id:  entry.orgId,
      user_id: entry.userId,
    });
  }

  return NextResponse.json({ status: "waiting" });
}

// ── PATCH /api/v1/extension/pair — Extension claims the token ────────────────
// Called by the extension popup when the user submits their token.
export async function PATCH(req: NextRequest) {
  const body = await req.json() as { token?: string; extension_id?: string };
  const token = body.token?.toUpperCase();

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const entry = pairTokens.get(token);

  if (!entry) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (entry.expires < Date.now()) {
    pairTokens.delete(token);
    return NextResponse.json({ error: "Token expired" }, { status: 410 });
  }

  entry.claimed = true;
  return NextResponse.json({ success: true, org_id: entry.orgId });
}
