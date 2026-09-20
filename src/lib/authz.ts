import { redirect } from "next/navigation";
import { type Role, auth } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export type SessionUser = { email: string | null; name: string | null; role: Role };

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return { email: session.user.email ?? null, name: session.user.name ?? null, role: session.user.role };
}

/** True for the admin; false for the viewer or when signed out. Drives what the UI renders. */
export async function isAdmin(): Promise<boolean> {
  return (await getSessionUser())?.role === "admin";
}

/**
 * Guard for every mutating server action. Throws for viewers and signed-out callers so a
 * hand-crafted POST cannot bypass the hidden buttons.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError("יש להתחבר כדי לבצע פעולה זו");
  if (user.role !== "admin") throw new UnauthorizedError("אין הרשאה לבצע שינויים — המשתמש מוגדר לצפייה בלבד");
  return user;
}

/** Guard for create/edit pages: viewers are sent back to the dashboard. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/");
}
