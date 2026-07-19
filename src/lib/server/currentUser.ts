import { isRole, type Role } from "../auth/roles";
import { getAdminUserById } from "./adminUserStore";
import { getOrCreateTransitionalUser } from "./storage/userStore";

export interface CurrentUser {
  id: string;
  displayName: string;
  email?: string | null;
  role: Role;
  accountType: "staff" | "public";
  phone?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  source: "database" | "transitional_env" | "json_user_store";
}

function resolveDefaultRole(): Role {
  const configuredRole = process.env.ADMIN_ROLE;

  if (isRole(configuredRole)) {
    return configuredRole;
  }

  if (process.env.NODE_ENV !== "production") {
    return "super_admin";
  }

  return "viewer";
}

/**
 * Transitional author identity resolver.
 *
 * The current auth model proves that an author session exists but does not yet
 * carry a database user id. Until database-backed users land, the role is
 * derived server-side from ADMIN_ROLE. Do not move this authority to
 * localStorage or any other browser-controlled state.
 */
export async function getCurrentUser(userId?: string): Promise<CurrentUser> {
  if (userId) {
    const user = await getAdminUserById(userId);
    if (!user || user.status !== "active") {
      throw new Error("Authenticated admin user is unavailable");
    }
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      accountType: user.accountType,
      phone: user.phone ?? null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt ?? null,
      passwordChangedAt: user.passwordChangedAt ?? null,
      source: "database",
    };
  }

  try {
    const user = await getOrCreateTransitionalUser();
    return {
      id: user.id,
      displayName: user.displayName,
      email: null,
      role: user.role,
      accountType: user.role === "viewer" || user.role === "member" ? "public" : "staff",
      phone: null,
      createdAt: null,
      lastLoginAt: null,
      passwordChangedAt: null,
      source: "json_user_store",
    };
  } catch {
    // If transitional file storage is unavailable, preserve the existing
    // server-side role resolver so auth does not fall back to browser state.
  }

  return {
    id: "local-author",
    displayName: "Author",
    email: null,
    role: resolveDefaultRole(),
    accountType: "staff",
    phone: null,
    createdAt: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    source: "transitional_env",
  };
}
