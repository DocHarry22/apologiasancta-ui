import type { VerifiedSession } from "@/lib/auth/session";
import type { CurrentUser } from "@/lib/server/currentUser";

export function isSessionFreshForUser(session: VerifiedSession, user: CurrentUser): boolean {
  if (!user.passwordChangedAt) return true;
  const changedAtMs = Date.parse(user.passwordChangedAt);
  if (!Number.isFinite(changedAtMs)) return true;
  return session.issuedAt >= changedAtMs;
}
