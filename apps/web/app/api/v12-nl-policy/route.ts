import { NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export async function POST(req: Request) {
  const nlSchema = z.object({
    prompt: z.string().min(1, "Natural language prompt is required."),
  });

  try {
    const rawBody = await req.json();
    const { prompt } = nlSchema.parse(rawBody);

    // Call the fast, accurate LLM to translate English -> Policy Syntax
    // Return a strict JSON policy representation
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        policy_id: z.string().describe("A url-safe identifier (e.g., healthcare-pii-block)"),
        rules: z.array(z.object({
          type: z.enum(["BLOCK", "REDACT", "WARN"]),
          target: z.string().describe("What to target, e.g., 'SSN', 'patient conditions', 'offensive language'"),
          reason: z.string().describe("A professional business reason for this rule"),
        }))
      }),
      prompt: `Translate the following organizational directive into a deterministic StreetMP Data Policy definition.
      Directive: "${prompt}"`,
    });

    return NextResponse.json({ success: true, policy: result.object });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to compile policy" }, { status: 500 });
  }
}
