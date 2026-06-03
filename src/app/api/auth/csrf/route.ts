import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionCookie, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/server/currentUser";
import { isSessionFreshForUser } from "@/lib/server/sessionFreshness";

/**
 * GET /api/auth/csrf
 *
 * Returns a CSRF token for the current author session.
 * Also refreshes the as_csrf_token cookie so the client can read it via document.cookie.
 *
 * Returns 401 if no valid session cookie is present.
 */
export async function GET() {
  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const session = await readSessionCookie(sessionValue);
  if (!session || !sessionValue) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentUser = await getCurrentUser(session.userId);
  if (!isSessionFreshForUser(session, currentUser)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csrfToken = await generateCsrfToken(sessionValue);

  const response = NextResponse.json({ ok: true, csrfToken });

  // Set a readable (non-httpOnly) cookie so the browser can include it in
  // the x-csrf-token request header.
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: csrfToken,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
