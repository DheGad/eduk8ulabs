/**
 * @file app/api/v1/onboarding/complete/route.ts
 * @description Marks onboarding as complete for the authenticated user.
 *   Writes `onboarding_completed = true` to the users/tenants table via
 *   the router-service. Falls back gracefully if the flag can't be set
 *   (the walkthrough should never block access to the dashboard).
 *
 *   POST /api/v1/onboarding/complete
 *   Authorization: Bearer <JWT>
 *
 *   Phase 3 — Enterprise UX & Onboarding
 */

import { NextRequest, NextResponse } from "next/server";

const ROUTER_URL =
  process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") ?? "";

    // Forward to the router-service user-update endpoint
    const res = await fetch(`${ROUTER_URL}/api/v1/user/onboarding/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ onboarding_completed: true }),
    });

    if (!res.ok) {
      // Non-fatal — log but do not block the frontend
      console.warn(
        `[Onboarding] Router-service returned ${res.status} — ` +
          "onboarding_completed flag may not have been persisted."
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // Non-fatal: the onboarding flag is best-effort
    console.error("[Onboarding] Failed to persist completion flag:", err);
    return NextResponse.json({ success: true }); // Still return success so UI advances
  }
}
