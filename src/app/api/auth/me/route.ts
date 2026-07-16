import type { NextRequest } from "next/server";
import { rolePermissions } from "@/lib/auth/roles";
import { requireAuthorSession, safeJson } from "@/lib/server/apiAuth";

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

