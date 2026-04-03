/**
 * @file app/api/auth/[...nextauth]/route.ts
 *
 * Thin NextAuth route handler. authOptions lives in @/lib/authOptions
 * so that other API routes can import it without triggering the Next.js 15
 * "not a valid Route export" type error on named exports.
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
