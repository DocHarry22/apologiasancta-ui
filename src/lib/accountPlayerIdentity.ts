import {
  isAuthSessionEpochCurrent,
  readAuthSessionEpoch,
} from "./playerIdentity";

export type AccountPlayerIdentityResult =
  | {
      kind: "joined";
      userId: string;
      username: string;
      joinToken: string;
      sessionBinding: string;
    }
  | { kind: "guest_fallback" }
  | { kind: "error"; message: string };

type FetchLike = typeof fetch;
const SESSION_BINDING_PATTERN = /^[a-zA-Z0-9_-]{43}$/;

/**
 * Requests an account-linked room credential without ever exposing the
 * backend assertion. Signed-out users and a deliberately disabled rollout
 * continue through the existing guest registration path.
 */
export async function requestAccountPlayerIdentity(
  input: { roomId: string; displayName: string },
  fetchImpl: FetchLike = fetch
): Promise<AccountPlayerIdentityResult> {
  const authSessionEpoch = readAuthSessionEpoch();
  let csrfResponse: Response;
  try {
    csrfResponse = await fetchImpl("/api/auth/csrf", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { kind: "guest_fallback" };
  }
  if (csrfResponse.status === 401 || csrfResponse.status >= 500) {
    return { kind: "guest_fallback" };
  }
  const csrfPayload = await csrfResponse.json().catch(() => null) as { csrfToken?: string } | null;
  if (!csrfResponse.ok || !csrfPayload?.csrfToken) {
    return { kind: "guest_fallback" };
  }

  let identityResponse: Response;
  try {
    identityResponse = await fetchImpl("/api/quiz/identity", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfPayload.csrfToken,
      },
      body: JSON.stringify(input),
    });
  } catch {
    return { kind: "guest_fallback" };
  }
  const identityPayload = await identityResponse.json().catch(() => null) as {
    userId?: string;
    username?: string;
    joinToken?: string;
    sessionBinding?: string;
    code?: string;
    error?: string;
  } | null;

  if (
    identityResponse.ok
    && identityPayload?.userId
    && identityPayload.username
    && identityPayload.joinToken
    && typeof identityPayload.sessionBinding === "string"
    && SESSION_BINDING_PATTERN.test(identityPayload.sessionBinding)
  ) {
    if (!isAuthSessionEpochCurrent(authSessionEpoch)) {
      // A logout/account switch won the race while the server-to-server
      // exchange was in flight. Reject without touching storage: a newer
      // request may already have saved a valid credential with the same
      // session binding.
      return {
        kind: "error",
        message: "Your account session changed while joining. Try again.",
      };
    }
    return {
      kind: "joined",
      userId: identityPayload.userId,
      username: identityPayload.username,
      joinToken: identityPayload.joinToken,
      sessionBinding: identityPayload.sessionBinding,
    };
  }
  if (identityPayload?.code === "account_identity_room_unsupported") {
    return { kind: "guest_fallback" };
  }
  if ([401, 404, 502, 503].includes(identityResponse.status)) {
    return { kind: "guest_fallback" };
  }
  return {
    kind: "error",
    message: identityPayload?.error || "Account-linked quiz identity could not be created.",
  };
}

/**
 * Confirms that a stored account room credential belongs to the currently
 * authenticated HTTP-only session. Failure is closed: callers must not resume
 * an account-linked Engine token when same-origin session proof is unavailable.
 */
export async function isAccountPlayerSessionCurrent(
  storedSessionBinding: string,
  fetchImpl: FetchLike = fetch
): Promise<boolean> {
  if (!storedSessionBinding) return false;
  try {
    const response = await fetchImpl("/api/quiz/identity", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as { sessionBinding?: string } | null;
    return response.ok
      && typeof payload?.sessionBinding === "string"
      && payload.sessionBinding === storedSessionBinding;
  } catch {
    return false;
  }
}
