import { NextRequest, NextResponse } from "next/server";
import { checkLoginRateLimit, clearLoginRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";

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
  const sessionSecret = process.env.AUTHOR_SESSION_SECRET;
  const missingVars = [
    !expectedPassword ? "AUTHOR_ADMIN_PASSWORD" : null,
    !sessionSecret ? "AUTHOR_SESSION_SECRET" : null,
  ].filter((entry): entry is string => Boolean(entry));

  if (missingVars.length > 0) {
    return NextResponse.json(
      {
        error: "Author auth is not configured on the server.",
        missingEnv: missingVars,
      },
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
  const csrfToken = await generateCsrfToken(sessionValue);
  const response = NextResponse.json({ ok: true });

  // Session cookie — httpOnly so JS cannot read it.
  // __Host- prefix in production enforces Secure, Path=/, and no Domain.
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  // CSRF cookie — readable by JS so the client can echo it in x-csrf-token header.
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: csrfToken,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  clearLoginRateLimit(ip);

  return response;
}
