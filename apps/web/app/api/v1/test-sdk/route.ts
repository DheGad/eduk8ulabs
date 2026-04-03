import { NextResponse } from "next/server";
import { StreetMP } from "@streetmp/sdk";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Instantiate our Zero-Change Wrapper
    // If the StreetMP wrapper works natively, it will hook into
    // the underlying OpenAI logic but enforce the `baseURL`.
    const client = new StreetMP({
      apiKey: process.env.OPENAI_API_KEY || "test_sk_mock_1234",
    });

    // We do not actually await the completions call hitting OpenAI
    // since we do not want to consume billing credits from a unit test.
    // Instead we dump the underlying configuration footprint to prove
    // that prototype chaining and constructor assignment functioned perfectly.
    
    return NextResponse.json({
      status: "success",
      sdkTargetURL: client.baseURL,
      injectedHeaders: (client as any).defaultHeaders, // bypass protected modifier for diagnostic endpoint
      payload: body,
      verified: client.baseURL === "https://api.streetmp.com/v1"
    });

  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
