import { createHash } from "node:crypto";

/**
 * Stable and non-reversible browser association for account-scoped local
 * archives. Authorization still comes exclusively from the HttpOnly session.
 */
export function getLearningProgressAccountScope(accountId: string): string {
  if (!accountId.trim()) throw new Error("Learning progress account ID is required.");
  return createHash("sha256")
    .update(`apologia-learning-progress-scope-v1:${accountId}`)
    .digest("base64url");
}
