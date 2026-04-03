import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getServerSession`, and the `SessionProvider` context.
   * Extended with StreetMP enterprise fields: role, id, org_id.
   */
  interface Session {
    user: {
      id:     string;
      role:   string;
      org_id: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role:   string;
    org_id: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?:     string;
    role?:   string;
    org_id?: string | null;
  }
}
