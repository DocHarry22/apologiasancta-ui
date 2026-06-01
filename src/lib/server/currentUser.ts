import { isRole, type Role } from "../auth/roles";
import { getAdminUserById } from "./adminUserStore";
import { getOrCreateTransitionalUser } from "./storage/userStore";

export interface CurrentUser {
  id: string;
  displayName: string;
  role: Role;
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
      role: user.role,
      source: "database",
    };
  }

  try {
    const user = await getOrCreateTransitionalUser();
    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      source: "json_user_store",
    };
  } catch {
    // If transitional file storage is unavailable, preserve the existing
    // server-side role resolver so auth does not fall back to browser state.
  }

  return {
    id: "local-author",
    displayName: "Author",
    role: resolveDefaultRole(),
    source: "transitional_env",
  };
}
