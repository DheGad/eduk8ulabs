/**
 * @file lib/authOptions.ts
 * @description NextAuth configuration — exported from a non-route file
 * so that it can be imported by other route handlers without triggering
 * the Next.js 15 "not a valid Route export" type error.
 *
 * The route file at app/api/auth/[...nextauth]/route.ts imports this
 * and passes it to NextAuth(). All other API routes that need
 * getServerSession() should import from here, not from the route.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider      from "next-auth/providers/google";
import GithubProvider      from "next-auth/providers/github";
import bcrypt              from "bcrypt";
import { pool }            from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function dbQuery<T = unknown>(sql: string, params: unknown[]): Promise<T[] | null> {
  try {
    const res = await pool.query(sql, params);
    return res.rows as T[];
  } catch {
    return null;
  }
}

async function notifyKernel(orgId: string, email: string) {
  try {
    const kernelUrl = process.env.NEXT_PUBLIC_ROUTER_SERVICE_URL ?? "http://localhost:4000";
    await fetch(`${kernelUrl}/api/v1/internal/org-activated`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-titan-bridge-key": process.env.TITAN_BRIDGE_KEY ?? "",
      },
      body: JSON.stringify({ org_id: orgId, email }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-blocking — kernel notification failure must never block login
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types
// ─────────────────────────────────────────────────────────────────────────────

interface AdminRow {
  id: string; email: string | null; username: string; password_hash: string;
}
interface UserRow {
  id: string; email: string; name: string | null;
  role: string | null; password_hash: string | null; org_id: string | null;
}
interface UserLookupRow {
  id: string; role: string | null; org_id: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthOptions
// ─────────────────────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID     || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: { params: { prompt: "select_account" } },
    }),
    GithubProvider({
      clientId:     process.env.GITHUB_CLIENT_ID     || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email:    { label: "Email",    type: "text"     },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const input = (credentials.email as string).trim().toLowerCase();

        // System admins (God Mode)
        const admins = await dbQuery<AdminRow>(
          "SELECT * FROM system_admins WHERE username = $1 OR email = $1",
          [input]
        );
        if (admins && admins.length > 0) {
          const admin = admins[0]!;
          const valid = await bcrypt.compare(credentials.password as string, admin.password_hash);
          if (!valid) return null;
          void dbQuery("UPDATE system_admins SET last_login = NOW() WHERE id = $1", [admin.id]);
          return { id: admin.id, email: admin.email ?? admin.username, name: admin.username, role: "GOD_MODE", org_id: null };
        }

        // Standard users
        const users = await dbQuery<UserRow>(
          "SELECT u.*, o.id as org_id FROM users u LEFT JOIN organizations o ON o.id = u.org_id WHERE u.email = $1",
          [input]
        );
        if (!users || users.length === 0) return null;
        const user = users[0]!;
        if (!user.password_hash) return null;
        const isValid = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (!isValid) return null;
        return {
          id:     user.id,
          email:  user.email,
          name:   user.name || user.email.split("@")[0],
          role:   user.role  || "USER",
          org_id: user.org_id || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id     = user.id;
        token.role   = (user as { role?: string }).role   || "USER";
        token.org_id = (user as { org_id?: string }).org_id || null;
      }

      if (account && (account.provider === "google" || account.provider === "github")) {
        const email = token.email as string;
        if (email) {
          const rows = await dbQuery<UserLookupRow>(
            "SELECT u.id, u.role, u.org_id FROM users u WHERE u.email = $1",
            [email]
          );
          if (rows && rows.length > 0) {
            token.id     = rows[0]!.id;
            token.role   = rows[0]!.role   || "USER";
            token.org_id = rows[0]!.org_id || null;
          } else {
            const { randomUUID } = await import("crypto");
            const userId = randomUUID();
            const orgId  = `org_${randomUUID()}`;
            await dbQuery(
              "INSERT INTO organizations (id, name, billing_provider, status, billing_email) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING",
              [orgId, email.split("@")[0] + " Workspace", "NONE", "ACTIVE", email]
            );
            await dbQuery(
              "INSERT INTO org_usage_quotas (org_id, current_month_executions) VALUES ($1, 0) ON CONFLICT DO NOTHING",
              [orgId]
            );
            await dbQuery(
              "INSERT INTO users (id, email, name, role, account_tier, org_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING",
              [userId, email, token.name || email.split("@")[0], "USER", "free", orgId]
            );
            token.id     = userId;
            token.role   = "USER";
            token.org_id = orgId;
            void notifyKernel(orgId, email);
          }
        }
      }

      if (token.id && token.role !== "GOD_MODE") {
        const check = await dbQuery<{ id: string }>("SELECT id FROM users WHERE id = $1", [token.id as string]);
        if (check !== null && check.length === 0) {
          return { ...token, id: "", role: "USER", org_id: null };
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id     = (token.id     as string) ?? "";
        session.user.role   = (token.role   as string) ?? "USER";
        session.user.org_id = (token.org_id as string) ?? null;
      }
      return session;
    },
  },
};
