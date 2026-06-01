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
      role: auth.user.role,
    },
    permissions: rolePermissions[auth.user.role],
  });
}

