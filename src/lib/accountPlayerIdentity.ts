export type AccountPlayerIdentityResult =
  | {
      kind: "joined";
      userId: string;
      username: string;
      joinToken: string;
    }
  | { kind: "guest_fallback" }
  | { kind: "error"; message: string };

type FetchLike = typeof fetch;

/**
 * Requests an account-linked room credential without ever exposing the
 * backend assertion. Signed-out users and a deliberately disabled rollout
 * continue through the existing guest registration path.
 */
export async function requestAccountPlayerIdentity(
  input: { roomId: string; displayName: string },
  fetchImpl: FetchLike = fetch
): Promise<AccountPlayerIdentityResult> {
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
    error?: string;
  } | null;

  if (
    identityResponse.ok
    && identityPayload?.userId
    && identityPayload.username
    && identityPayload.joinToken
  ) {
    return {
      kind: "joined",
      userId: identityPayload.userId,
      username: identityPayload.username,
      joinToken: identityPayload.joinToken,
    };
  }
  if ([401, 404, 502, 503].includes(identityResponse.status)) {
    return { kind: "guest_fallback" };
  }
  return {
    kind: "error",
    message: identityPayload?.error || "Account-linked quiz identity could not be created.",
  };
}
