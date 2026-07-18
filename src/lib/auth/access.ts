import type { Role } from "@/lib/auth/roles";

const STAFF_ROLES: ReadonlySet<Role> = new Set([
  "super_admin",
  "admin",
  "editor",
  "author",
  "contributor",
  "reviewer",
  "host",
]);

const LEARNER_ROLES: ReadonlySet<Role> = new Set(["member", "viewer"]);

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.has(role);
}

export function isLearnerRole(role: Role): boolean {
  return LEARNER_ROLES.has(role);
}

export function getRoleHomePath(role: Role): "/admin" | "/" {
  return isStaffRole(role) ? "/admin" : "/";
}
