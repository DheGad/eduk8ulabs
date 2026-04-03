/**
 * @file app/api/spending/route.ts
 * @description Live Spending Widget API
 *
 * GET /api/spending
 *   Returns total cost from execution_costs table (with usage_logs fallback).
 *   Powers the Dashboard spending card and the V22 2.0 Cost Engine display.
 */

import { NextResponse } from "next/server";
import { getSpendingTotals, getRecentCostEvents } from "@/lib/costEngine";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(): Promise<NextResponse> {
  try {
    const [totals, recentEvents] = await Promise.all([
      getSpendingTotals(),
      getRecentCostEvents(15),
    ]);

    return NextResponse.json({ totals, recentEvents });
  } catch (err) {
    console.error("[/api/spending]", err);
    return NextResponse.json({ error: "Failed to load spending data." }, { status: 500 });
  }
}
