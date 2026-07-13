import { createHash, timingSafeEqual } from "node:crypto";
import { isRole, type Role } from "@/lib/auth/roles";

function normalizeInviteCode(value: string | undefined): string {
  return (value || "").trim();
}

function inviteCodesEqual(expected: string, provided: string): boolean {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

function resolveStaffInviteRole(configuredRole?: string): Role {
  const configured = configuredRole ?? process.env.AUTH_SIGNUP_STAFF_ROLE;
  if (isRole(configured) && configured !== "super_admin") {
    return configured;
  }
  return "host";
}

export interface SignupRoleDecision {
  role: Role;
  inviteAccepted: boolean;
}

export function resolveSignupRole(
  inviteCode: string | undefined,
  options?: { expectedInviteCode?: string; staffRole?: string }
): SignupRoleDecision {
  const expectedCode = normalizeInviteCode(options?.expectedInviteCode ?? process.env.AUTH_SIGNUP_STAFF_INVITE_CODE);
  const providedCode = normalizeInviteCode(inviteCode);

  if (!expectedCode || !providedCode || !inviteCodesEqual(expectedCode, providedCode)) {
    return { role: "viewer", inviteAccepted: false };
  }

  return {
    role: resolveStaffInviteRole(options?.staffRole),
    inviteAccepted: true,
  };
}
