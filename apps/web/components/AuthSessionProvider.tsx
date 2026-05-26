/**
 * @file components/AuthSessionProvider.tsx
 * @description Thin "use client" wrapper that provides NextAuth SessionProvider
 * to the entire React tree.
 *
 * WHY THIS EXISTS:
 *   app/layout.tsx is a Next.js Server Component. You cannot import or render
 *   client-side hooks (like SessionProvider) directly inside a Server Component.
 *   The pattern is to create a minimal "use client" boundary here, then import
 *   this component into the Server Component layout.
 *
 * WITHOUT THIS:
 *   - signIn() / signOut() from "next-auth/react" throw runtime errors
 *   - useSession() returns { data: null, status: "loading" } forever
 *   - Google OAuth button appears to do nothing visible to the user
 *   - All auth-gated UI shows blank or loading state permanently
 *
 * PRODUCTION SAFETY: Zero risk. SessionProvider is stateless on the server.
 * It only injects a React context value on the client.
 */
"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

interface AuthSessionProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
  return (
    <SessionProvider
      session={session}
      // Refetch session every 5 minutes to keep it alive for long-running dashboard sessions
      refetchInterval={5 * 60}
      // Re-validate when window regains focus (catches tab-switch token expiry)
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  );
}
