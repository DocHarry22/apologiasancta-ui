import { NextRequest, NextResponse } from "next/server";
import { checkLoginRateLimit, clearLoginRateLimit, getClientIp } from "@/lib/auth/rateLimit";
import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";
import { CSRF_COOKIE_NAME, generateCsrfToken } from "@/lib/csrf";
import { getRoleHomePath, isStaffRole } from "@/lib/auth/access";
import { resolveSignupRole } from "@/lib/auth/invite";
import { getAuthInviteSettings } from "@/lib/server/authInviteSettings";
import { createAdminUser } from "@/lib/server/adminUserStore";

interface SignupBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  confirmPassword?: unknown;
  phone?: unknown;
  inviteCode?: unknown;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = checkLoginRateLimit(ip);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
      {
        status: 429,
        headers: limit.retryAfterSeconds
          ? { "Retry-After": String(limit.retryAfterSeconds) }
          : undefined,
      }
    );
  }

  const sessionSecret = process.env.AUTHOR_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json(
      {
        error: "Auth is not configured on the server.",
        missingEnv: ["AUTHOR_SESSION_SECRET"],
      },
      { status: 500 }
    );
  }

  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const displayName = normalizeText(body.name);
  const email = normalizeText(body.email).toLowerCase();
  const password = normalizeText(body.password);
  const confirmPassword = normalizeText(body.confirmPassword);
  const phone = normalizeText(body.phone);
  const inviteCode = normalizeText(body.inviteCode);

  if (!displayName || displayName.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
  }

  const inviteSettings = await getAuthInviteSettings();
  const roleDecision = resolveSignupRole(inviteCode || undefined, {
    expectedInviteCode: inviteSettings.inviteCode,
    staffRole: inviteSettings.staffRole,
  });
  if (inviteCode && !roleDecision.inviteAccepted) {
    return NextResponse.json({ error: "Invite code is invalid." }, { status: 403 });
  }

  const role = roleDecision.role;
  const accountType = isStaffRole(role) ? "staff" : "public";

  const created = await createAdminUser({
    email,
    password,
    displayName,
    role,
    accountType,
    phone: phone || null,
  });

  if (!created) {
    return NextResponse.json({ error: "Unable to create account. Email may already be in use." }, { status: 409 });
  }

  const sessionValue = await createSessionCookie(created.id);
  const csrfToken = await generateCsrfToken(sessionValue);
  const response = NextResponse.json({
    ok: true,
    redirectTo: getRoleHomePath(created.role),
    user: {
      id: created.id,
      email: created.email,
      displayName: created.displayName,
      role: created.role,
      accountType: created.accountType,
      phone: created.phone ?? null,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

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
