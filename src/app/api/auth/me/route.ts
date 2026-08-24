import type { NextRequest } from "next/server";
import { rolePermissions } from "@/lib/auth/roles";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { deletePublicAccount } from "@/lib/server/accountDeletion";
import { readJsonBody, requireAuthorSession, requireCsrf, safeJson } from "@/lib/server/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  return safeJson({
    ok: true,
    user: {
      id: auth.user.id,
      displayName: auth.user.displayName,
      email: auth.user.email ?? null,
      role: auth.user.role,
      accountType: auth.user.accountType,
      phone: auth.user.phone ?? null,
      createdAt: auth.user.createdAt ?? null,
      lastLoginAt: auth.user.lastLoginAt ?? null,
    },
    permissions: rolePermissions[auth.user.role],
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  if (auth.user.accountType !== "public") {
    return safeJson({ ok: false, error: "Staff accounts cannot be deleted through the public account flow." }, 403);
  }

  const csrfFailure = await requireCsrf(request, auth.user);
  if (csrfFailure) return csrfFailure;

  const body = await readJsonBody(request);
  if (body.confirmation !== "DELETE") {
    return safeJson({ ok: false, error: "Type DELETE to confirm permanent account deletion." }, 400);
  }

  try {
    const result = await deletePublicAccount(auth.user.id);
    if (!result.ok) {
      return safeJson({ ok: false, error: "Account deletion is temporarily unavailable. Please retry." }, 503);
    }

    const response = safeJson({ ok: true, deleted: true, learningProfileDeleted: result.learningProfileDeleted });
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
  } catch {
    return safeJson({ ok: false, error: "Account deletion is temporarily unavailable. Please retry." }, 503);
  }
}
