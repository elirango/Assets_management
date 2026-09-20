import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Runs before every matched request (Node runtime). Signed-out visitors go to /login;
// viewers are kept off create/edit screens (the server actions are guarded separately).
export const proxy = auth((request) => {
  const { pathname, search } = request.nextUrl;
  const user = request.auth?.user;

  if (!user) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user.role !== "admin" && /\/(new|edit)(\/|$)/.test(pathname)) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Everything except the auth endpoints, the login page and static assets.
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon\.ico).*)"],
};
