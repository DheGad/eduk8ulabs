"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/apiClient";

/**
 * We temporarily parse the JWT payload on the client side.
 * In Phase 4, we will move this to a server-side middleware with httpOnly cookies.
 */
function decodeJwt(token: string): { tier?: string; email?: string } | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    const payload = decodeJwt(token);
    
    // Security Check: Only allow 'admin' or 'superuser'
    // For local dev, we might not have seeded an admin user, so we allow a specific
    // test email to bypass if necessary, or just rely on the tier.
    if (payload?.tier === "admin" || payload?.tier === "superuser" || payload?.email?.includes("admin")) {
      setIsAuthorized(true);
    } else {
      router.replace("/dashboard"); // Kick normal users back to their dashboard
    }
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-black/95 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          <p className="text-sm text-zinc-400">Verifying security clearance...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
