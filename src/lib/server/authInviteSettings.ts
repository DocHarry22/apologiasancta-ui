import { randomBytes } from "node:crypto";
import { isRole, type Role } from "@/lib/auth/roles";
import { JsonStore } from "@/lib/server/storage/jsonStore";

const inviteSettingsStore = new JsonStore<AuthInviteSettingsRecord | null>("auth-invite-settings.json", null);

const ALLOWED_STAFF_INVITE_ROLES: readonly Role[] = ["admin", "editor", "author", "contributor", "reviewer", "host"];

interface AuthInviteSettingsRecord {
  inviteCode: string;
  staffRole: Role;
  updatedAt: string;
}

export interface AuthInviteSettings {
  inviteCode: string;
  staffRole: Role;
  updatedAt: string;
  source: "store" | "env" | "default";
}

function normalizeInviteCode(value: string | undefined): string {
  return (value || "").trim();
}

function resolveValidInviteRole(value: string | undefined): Role {
  if (isRole(value) && ALLOWED_STAFF_INVITE_ROLES.includes(value)) {
    return value;
  }
  return "host";
}

function fallbackSettings(): AuthInviteSettings {
  const inviteCode = normalizeInviteCode(process.env.AUTH_SIGNUP_STAFF_INVITE_CODE);
  const staffRole = resolveValidInviteRole(process.env.AUTH_SIGNUP_STAFF_ROLE);

  if (inviteCode) {
    return {
      inviteCode,
      staffRole,
      updatedAt: new Date(0).toISOString(),
      source: "env",
    };
  }

  return {
    inviteCode: "",
    staffRole,
    updatedAt: new Date(0).toISOString(),
    source: "default",
  };
}

export function isAllowedStaffInviteRole(role: string | undefined | null): role is Role {
  return Boolean(role && isRole(role) && ALLOWED_STAFF_INVITE_ROLES.includes(role));
}

export function generateInviteCode(): string {
  return randomBytes(9).toString("base64url");
}

export async function getAuthInviteSettings(): Promise<AuthInviteSettings> {
  const stored = await inviteSettingsStore.read();
  if (!stored) {
    return fallbackSettings();
  }

  return {
    inviteCode: normalizeInviteCode(stored.inviteCode),
    staffRole: resolveValidInviteRole(stored.staffRole),
    updatedAt: stored.updatedAt,
    source: "store",
  };
}

export async function setAuthInviteSettings(input: { inviteCode: string; staffRole: Role }): Promise<AuthInviteSettings> {
  const inviteCode = normalizeInviteCode(input.inviteCode);
  const staffRole = resolveValidInviteRole(input.staffRole);
  const updatedAt = new Date().toISOString();

  await inviteSettingsStore.write({ inviteCode, staffRole, updatedAt });

  return {
    inviteCode,
    staffRole,
    updatedAt,
    source: "store",
  };
}

export async function resetAuthInviteSettingsForTests(): Promise<void> {
  await inviteSettingsStore.write(null);
}
