"use server";

import { signIn, signOut } from "@/lib/auth";

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const callbackUrl = formData.get("callbackUrl");
  const redirectTo = typeof callbackUrl === "string" && callbackUrl.startsWith("/") ? callbackUrl : "/";
  await signIn("google", { redirectTo });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
