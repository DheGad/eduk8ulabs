import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.STREETMP_ADMIN_SECRET || "";
  return NextResponse.json({ token });
}
