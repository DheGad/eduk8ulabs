import { NextRequest, NextResponse } from "next/server";

/**
 * @route POST /api/workspace/chat
 * @phase Phase 6 — Gold Master Workspace
 * @description
 *   Proxies PII-scrubbed prompts (already masked client-side) to the
 *   router-service LLM proxy. TITAN_BRIDGE_KEY is REQUIRED — requests
 *   without a configured key are rejected with 403.
 *
 *   The client performs maskPII BEFORE calling this endpoint.
 *   This route is therefore the final checkpoint: it validates the key
 *   and forwards the already-redacted content.
 */

const ROUTER_URL = process.env.ROUTER_SERVICE_URL ?? "http://localhost:4000/api/v1";
const TITAN_BRIDGE_KEY = process.env.TITAN_BRIDGE_KEY ?? "";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Guard: TITAN_BRIDGE_KEY REQUIRED ─────────────────────────────────────
  if (!TITAN_BRIDGE_KEY) {
    return NextResponse.json(
      { success: false, error: "TITAN_BRIDGE_KEY is not configured. File processing is disabled." },
      { status: 403 }
    );
  }

  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ success: false, error: "Prompt is required." }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${ROUTER_URL}/proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-titan-bridge-key": TITAN_BRIDGE_KEY,
        // Signal to the router-service that PII was already masked client-side
        "x-pii-masked": "1",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "Unknown upstream error");
      return NextResponse.json(
        { success: false, error: `Upstream error ${upstream.status}: ${errText}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json();

    // Extract the reply from OpenAI-compatible response shape
    const reply: string =
      data?.choices?.[0]?.message?.content ??
      data?.reply ??
      "Model returned an empty response.";

    return NextResponse.json({ success: true, reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
