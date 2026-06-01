import { isRole, type Role } from "../../auth/roles";
import { JsonStore } from "./jsonStore";
import type { StoredUser } from "./types";

const userStore = new JsonStore<StoredUser[]>("users.json", []);

export function resolveDefaultRole(): Role {
  const configuredRole = process.env.AUTHOR_DEFAULT_ROLE;
  if (isRole(configuredRole)) return configuredRole;
  if (process.env.NODE_ENV !== "production") return "super_admin";
  return "viewer";
}

export async function getOrCreateTransitionalUser(): Promise<StoredUser> {
  const users = await userStore.read();
  const now = new Date().toISOString();
  const role = resolveDefaultRole();
  const existing = users.find((user) => user.id === "local-author");
  if (existing) {
    const updated = { ...existing, role, status: "active" as const, updatedAt: now };
    await userStore.write(users.map((user) => user.id === updated.id ? updated : user));
    return updated;
  }

  const user: StoredUser = {
    id: "local-author",
    displayName: "Author",
    role,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await userStore.write([user, ...users]);
  return user;
}
