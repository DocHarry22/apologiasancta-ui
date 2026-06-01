import { NextRequest, NextResponse } from "next/server";
import { checkLoginRateLimit, clearLoginRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { authenticateAdminUser } from "@/lib/server/adminUserStore";

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

  const sessionSecret = process.env.AUTHOR_SESSION_SECRET;
  const missingVars = [
    !sessionSecret ? "AUTHOR_SESSION_SECRET" : null,
  ].filter((entry): entry is string => Boolean(entry));

  if (missingVars.length > 0) {
    return NextResponse.json(
      {
        error: "Admin auth is not configured on the server.",
        missingEnv: missingVars,
      },
      { status: 500 }
    );
  }

  let email = "";
  let password = "";
  try {
    const body = (await req.json()) as { email?: unknown; password?: unknown };
    email = typeof body?.email === "string" ? body.email : "";
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let user = null;
  try {
    user = await authenticateAdminUser(email, password);
  } catch {
    return NextResponse.json({ error: "Admin auth is not configured on the server." }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const sessionValue = await createSessionCookie(user.id);
  const csrfToken = await generateCsrfToken(sessionValue);
  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });

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
