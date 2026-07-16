import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";

const DEFAULT_PUBLIC_APP_ORIGIN = "https://sandybrown-bear-488955.hostingersite.com";

function publicAppOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (["http:", "https:"].includes(url.protocol)) return url.origin;
    } catch {
      // Fall through to a safe origin rather than reflecting an invalid value.
    }
  }
  return process.env.NODE_ENV === "production"
    ? DEFAULT_PUBLIC_APP_ORIGIN
    : request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const requestedNext = request.nextUrl.searchParams.get("next");
  const nextPath = requestedNext === "/author/login" ? "/author/login" : "/admin/login";
  const response = NextResponse.redirect(new URL(nextPath, publicAppOrigin(request)), { status: 303 });
  response.headers.set("Cache-Control", "no-store");

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: "",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
