import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  const requestedNext = request.nextUrl.searchParams.get("next");
  const nextPath = requestedNext === "/author/login" ? "/author/login" : "/admin/login";
  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });

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
