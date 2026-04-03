import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.TITAN_BRIDGE_KEY || "";
  return NextResponse.json({ token });
}
