export const roles = [
  "super_admin",
  "admin",
  "editor",
  "author",
  "contributor",
  "member",
  "reviewer",
  "host",
  "viewer",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "dashboard:view",
  "overview:view",
  "live:control",
  "rooms:manage",
  "content:view",
  "content:import",
  "content:draft:create",
  "content:draft:edit_own",
  "content:submit_review",
  "content:review",
  "content:publish",
  "learning:view",
  "learning:manage",
  "learning:review",
  "learning:publish",
  "learning:audit",
  "topics:manage",
  "topic_sequence:manage",
  "audit:view",
  "settings:view",
  "users:manage",
  "dangerous:execute",
] as const;

export type Permission = (typeof permissions)[number];

export const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  editor: "Editor",
  author: "Author",
  contributor: "Contributor",
  member: "Member / Learner",
  reviewer: "Reviewer",
  host: "Host",
  viewer: "Viewer",
};

export const rolePermissions: Record<Role, readonly Permission[]> = {
  super_admin: permissions,
  admin: [
    "dashboard:view",
    "overview:view",
    "live:control",
    "rooms:manage",
    "content:view",
    "content:import",
    "topics:manage",
    "topic_sequence:manage",
    "audit:view",
    "settings:view",
    "dangerous:execute",
    "learning:view",
    "learning:manage",
    "learning:review",
    "learning:publish",
    "learning:audit",
  ],
  editor: [
    "dashboard:view",
    "overview:view",
    "content:view",
    "content:draft:create",
    "content:draft:edit_own",
    "content:submit_review",
    "content:review",
    "content:publish",
    "audit:view",
    "settings:view",
    "learning:view",
    "learning:manage",
    "learning:review",
    "learning:publish",
    "learning:audit",
  ],
  author: [
    "dashboard:view",
    "overview:view",
    "content:view",
    "content:import",
    "content:draft:create",
    "content:draft:edit_own",
    "content:submit_review",
    "settings:view",
    "learning:view",
    "learning:manage",
  ],
  contributor: [
    "dashboard:view",
    "overview:view",
    "content:view",
    "content:draft:create",
    "content:draft:edit_own",
    "content:submit_review",
    "settings:view",
    "learning:view",
    "learning:manage",
  ],
  member: [
    "learning:view",
  ],
  reviewer: [
    "dashboard:view",
    "overview:view",
    "content:view",
    "content:review",
    "audit:view",
    "settings:view",
    "learning:view",
    "learning:review",
    "learning:audit",
  ],
  host: [
    "dashboard:view",
    "overview:view",
    "live:control",
    "rooms:manage",
    "settings:view",
  ],
  viewer: [
    "dashboard:view",
    "overview:view",
    "content:view",
    "settings:view",
    "learning:view",
  ],
};

export function isRole(value: string | undefined | null): value is Role {
  return roles.includes(value as Role);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function hasAnyPermission(role: Role, permissionsToCheck: readonly Permission[]): boolean {
  return permissionsToCheck.some((permission) => hasPermission(role, permission));
}

export function requirePermission(role: Role, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Role ${role} does not have permission ${permission}`);
  }
}
