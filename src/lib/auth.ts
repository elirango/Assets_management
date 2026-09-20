import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

export type Role = "admin" | "viewer";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { role: Role };
  }
}

/**
 * Binary RBAC driven by environment variables: ADMIN_EMAIL gets full access,
 * VIEWER_EMAIL is read-only, anyone else is refused at sign-in.
 */
export function roleForEmail(email: string | null | undefined): Role | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === process.env.ADMIN_EMAIL?.trim().toLowerCase()) return "admin";
  if (normalized === process.env.VIEWER_EMAIL?.trim().toLowerCase()) return "viewer";
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET; AUTH_SECRET signs the session cookie.
  providers: [Google],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    signIn({ user }) {
      return roleForEmail(user.email) !== null;
    },
    // Re-derive the role on every token refresh so changing the env vars takes effect
    // without users having to sign out.
    jwt({ token }) {
      // The JWT type is not augmentable in this next-auth build; `role` is a plain claim.
      token.role = roleForEmail(token.email) ?? undefined;
      return token;
    },
    session({ session, token }) {
      // Least privilege: a token without a resolvable role behaves as a viewer.
      session.user.role = (token.role as Role | undefined) ?? "viewer";
      return session;
    },
  },
});
