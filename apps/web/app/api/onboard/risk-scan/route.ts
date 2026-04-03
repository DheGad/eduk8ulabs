/**
 * @file app/api/onboard/risk-scan/route.ts
 * @version V99
 * @description Proxies the V86 API key risk scan to the router-service.
 * Validates that an AI provider key is structurally sound before the user pays.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const scanSchema = z.object({
      apiKey: z.string().min(1, "apiKey is required"),
      provider: z.string().min(1, "provider is required"),
    });
    
    let parsedBody;
    try {
      parsedBody = scanSchema.parse(await req.json());
    } catch(err) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    const { apiKey, provider } = parsedBody;

    // Run a structural risk assessment (no actual calls made to OpenAI/Anthropic)
    const risks: string[] = [];
    const passes: string[] = [];

    // Pattern validation per provider
    const patterns: Record<string, RegExp> = {
      openai: /^sk-[a-zA-Z0-9\-_]{20,}$/,
      anthropic: /^sk-ant-[a-zA-Z0-9\-_]{40,}$/,
      gemini: /^AIza[a-zA-Z0-9\-_]{35,}$/,
    };

    const pattern = patterns[provider.toLowerCase()];
    if (pattern && pattern.test(apiKey)) {
      passes.push(`Key format matches ${provider.toUpperCase()} specification`);
    } else {
      risks.push(`Key format does not match expected ${provider.toUpperCase()} pattern — may be invalid`);
    }

    // Check for accidental PII in the key (e.g. email in key name — shouldn't happen but guard anyway)
    if (/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+/.test(apiKey)) {
      risks.push("Key appears to contain an email address — likely misconfigured");
    } else {
      passes.push("No PII detected in key material");
    }

    // Entropy check
    const uniqueChars = new Set(apiKey.replace(/^(sk-|AIza)/, "")).size;
    if (uniqueChars > 8) {
      passes.push("Key entropy within acceptable range");
    } else {
      risks.push("Low entropy detected — key may be a placeholder");
    }

    // V86 DLP: Check for known test/demo patterns
    const testPatterns = ["YOUR_API_KEY", "sk-test", "demo", "placeholder", "example", "1234"];
    const isTestKey = testPatterns.some((p) => apiKey.toLowerCase().includes(p.toLowerCase()));
    if (isTestKey) {
      risks.push("Key matches known test/placeholder patterns — not suitable for production");
    } else {
      passes.push("No known test/demo patterns detected");
    }

    const riskLevel = risks.length === 0 ? "LOW" : risks.length === 1 ? "MEDIUM" : "HIGH";
    const approved = riskLevel !== "HIGH";

    return NextResponse.json({
      riskLevel,
      approved,
      risks,
      passes,
      provider: provider.toUpperCase(),
      scannedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
