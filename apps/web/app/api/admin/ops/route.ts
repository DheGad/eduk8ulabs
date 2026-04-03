import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Call the router-service backend internally
    // Assuming internal network routing routes `router-service` on port 3001
    // The STREETMP_ADMIN_SECRET ensures secure access.
    const routerServiceUrl = process.env.ROUTER_SERVICE_URL || "http://localhost:3001";
    
    // Hardcoded for founder / admin actions
    const adminSecret = process.env.STREETMP_ADMIN_SECRET || "dev_secret_bypass";

    const backendRes = await fetch(`${routerServiceUrl}/api/v1/admin/ops/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
        // Typically, we'd also pass `x-internal-token` or similar depending on how injectSessionRole works.
        // Let's pass the admin secret which should bypass or fulfill RBAC.
      },
      body: JSON.stringify(body),
    });

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return NextResponse.json({ success: false, error: `Backend Error: ${errorText}` }, { status: backendRes.status });
    }

    const data = await backendRes.json();
    return NextResponse.json(data);

  } catch (err: any) {
    console.error("[V98:OpsProxy] Failed to connect to core router:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
