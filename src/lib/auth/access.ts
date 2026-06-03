import type { Role } from "@/lib/auth/roles";

const STAFF_ROLES: ReadonlySet<Role> = new Set([
  "super_admin",
  "admin",
  "author",
  "reviewer",
  "host",
]);

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.has(role);
}

export function getRoleHomePath(role: Role): "/admin" | "/" {
  return isStaffRole(role) ? "/admin" : "/";
}
