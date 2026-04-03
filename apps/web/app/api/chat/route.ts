import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const routerOpenAI = createOpenAI({
  baseURL: process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL + "/v1",
  apiKey: process.env.STREETMP_API_KEY || "sk-demo-token",
});

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();

    const result = streamText({
      model: routerOpenAI(model || "streetmp-auto"),
      messages,
      headers: {
        "x-tenant-id": "dev-sandbox"
      }
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
