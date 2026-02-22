import { NextRequest, NextResponse } from "next/server";
import { checkLoginRateLimit, clearLoginRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkLoginRateLimit(ip);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: limit.retryAfterSeconds
          ? { "Retry-After": String(limit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  const expectedPassword = process.env.AUTHOR_ADMIN_PASSWORD;
  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Author auth is not configured on the server." },
      { status: 500 }
    );
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: unknown };
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (password !== expectedPassword) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const sessionValue = await createSessionCookie();
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  clearLoginRateLimit(ip);

  return response;
}
