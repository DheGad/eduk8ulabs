import { NextRequest, NextResponse } from "next/server";

const ROUTER_PROXY = "http://localhost:4000/api/v1";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/api/ctrl-titan-9x2k/proxy/", "");
  const query = url.search;
  
  try {
     const res = await fetch(`${ROUTER_PROXY}/${path}${query}`, {
       headers: {
         "x-admin-secret": process.env.STREETMP_ADMIN_SECRET || ""
       }
     });
     const data = await res.json();
     return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/api/ctrl-titan-9x2k/proxy/", "");
  const body = await req.json().catch(() => ({}));

  try {
     const res = await fetch(`${ROUTER_PROXY}/${path}`, {
       method: "POST",
       headers: {
         "x-admin-secret": process.env.STREETMP_ADMIN_SECRET || "",
         "Content-Type": "application/json"
       },
       body: JSON.stringify(body)
     });
     const data = await res.json();
     return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname.replace("/api/ctrl-titan-9x2k/proxy/", "");
  const body = await req.json().catch(() => ({}));

  try {
     const res = await fetch(`${ROUTER_PROXY}/${path}`, {
       method: "PATCH",
       headers: {
         "x-admin-secret": process.env.STREETMP_ADMIN_SECRET || "",
         "Content-Type": "application/json"
       },
       body: JSON.stringify(body)
     });
     const data = await res.json();
     return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
