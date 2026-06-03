import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/auth/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sessionValue = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isValid = await verifySessionCookie(sessionValue);

  if (
    pathname === "/author/login" ||
    pathname === "/author/login/" ||
    pathname === "/admin/login" ||
    pathname === "/admin/login/"
  ) {
    if (isValid) {
      const destination = req.nextUrl.clone();
      destination.pathname = "/";
      destination.search = "";
      return NextResponse.redirect(destination);
    }
    return NextResponse.next();
  }

  if (
    pathname === "/signup" ||
    pathname === "/signup/" ||
    pathname.startsWith("/api/auth/")
  ) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/author") && !pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (isValid) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = pathname.startsWith("/admin") ? "/admin/login" : "/author/login";
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/author/:path*", "/admin/:path*", "/api/auth/:path*"],
};
