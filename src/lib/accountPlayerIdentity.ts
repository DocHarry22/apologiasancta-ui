import {
  isAuthSessionEpochCurrent,
  readAuthSessionEpoch,
} from "./playerIdentity";
import { fetchJsonWithTimeout } from "./fetchWithTimeout";

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
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<AccountPlayerIdentityResult> {
  const authSessionEpoch = readAuthSessionEpoch();
  let csrfResult;
  try {
    csrfResult = await fetchJsonWithTimeout<{ csrfToken?: string }>("/api/auth/csrf", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }, undefined, fetchImpl);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "guest_fallback" };
  }
  const csrfResponse = csrfResult.response;
  if (csrfResponse.status === 401 || csrfResponse.status >= 500) {
    return { kind: "guest_fallback" };
  }
  const csrfPayload = csrfResult.data ?? null;
  if (!csrfResponse.ok || !csrfPayload?.csrfToken) {
    return { kind: "guest_fallback" };
  }

  let identityResult;
  try {
    identityResult = await fetchJsonWithTimeout<{
      userId?: string;
      username?: string;
      joinToken?: string;
      sessionBinding?: string;
      code?: string;
      error?: string;
    }>("/api/quiz/identity", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfPayload.csrfToken,
      },
      body: JSON.stringify(input),
      signal,
    }, undefined, fetchImpl);
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "guest_fallback" };
  }
  const identityResponse = identityResult.response;
  const identityPayload = identityResult.data ?? null;

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
  fetchImpl: FetchLike = fetch,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!storedSessionBinding) return false;
  try {
    const result = await fetchJsonWithTimeout<{ sessionBinding?: string }>("/api/quiz/identity", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }, undefined, fetchImpl);
    const response = result.response;
    const payload = result.data ?? null;
    return response.ok
      && typeof payload?.sessionBinding === "string"
      && payload.sessionBinding === storedSessionBinding;
  } catch (error) {
    if (signal?.aborted) throw error;
    return false;
  }
}
