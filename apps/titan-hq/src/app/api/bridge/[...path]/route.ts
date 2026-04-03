import { NextRequest, NextResponse } from "next/server";

const ROUTER_URL = "http://localhost:4000/api/v1/bridge-hq";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/api/bridge/", "");
  const query = url.search;
  
  try {
     const res = await fetch(`${ROUTER_URL}/${path}${query}`, {
       headers: {
         "x-titan-bridge-key": process.env.TITAN_BRIDGE_KEY || ""
       }
     });
     const data = await res.json();
     return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/api/bridge/", "");
  const body = await req.json().catch(() => ({}));

  try {
     const res = await fetch(`${ROUTER_URL}/${path}`, {
       method: "POST",
       headers: {
         "x-titan-bridge-key": process.env.TITAN_BRIDGE_KEY || "",
         "Content-Type": "application/json"
       },
       body: JSON.stringify(body)
     });
     const data = await res.json();
     return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/api/bridge/", "");
  const body = await req.json().catch(() => ({}));

  try {
     const res = await fetch(`${ROUTER_URL}/${path}`, {
       method: "PATCH",
       headers: {
         "x-titan-bridge-key": process.env.TITAN_BRIDGE_KEY || "",
         "Content-Type": "application/json"
       },
       body: JSON.stringify(body)
     });
     const data = await res.json();
     return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
