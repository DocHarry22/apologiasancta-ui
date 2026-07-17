import type { NextRequest } from "next/server";
import { checkAccountIdentityRateLimit } from "@/lib/auth/rateLimit";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  classifyAccountIdentityInput,
  createAccountIdentityAssertion,
  createAccountIdentitySessionBinding,
  getAccountIdentityConfiguration,
  getAccountIdentityExchangeUrl,
} from "@/lib/server/accountIdentity";
import { readJsonBody, requireAuthorSession, requireCsrf, safeJson } from "@/lib/server/apiAuth";

export const dynamic = "force-dynamic";

interface EngineIdentityResponse {
  ok?: boolean;
  userId?: string;
  username?: string;
  roomId?: string;
  joinToken?: string;
  identityType?: string;
  identityCreated?: boolean;
  displayNameAdjusted?: boolean;
  reason?: string;
}

const ENGINE_ACCOUNT_ID_PATTERN = /^acct_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const JOIN_TOKEN_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;

function noStore(response: ReturnType<typeof safeJson>) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function unavailableResponse() {
  return noStore(safeJson({
    ok: false,
    code: "account_identity_unavailable",
    error: "Account-linked quiz identity is not available.",
  }, 503));
}

/**
 * Returns only the one-way binding for the current HTTP-only session. The
 * browser uses it to reject an account room token after logout, account
 * switching, session rotation, or secret rotation.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  // The UI flag is also the rollback boundary for credentials that were
  // minted earlier. Do not validate a stored account token while this side of
  // the bridge is disabled or otherwise incomplete.
  const configuration = getAccountIdentityConfiguration();
  if (!configuration.ready) return unavailableResponse();

  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionValue) return unavailableResponse();

  try {
    return noStore(safeJson({
      ok: true,
      sessionBinding: createAccountIdentitySessionBinding(sessionValue),
    }));
  } catch {
    return unavailableResponse();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthorSession(request);
  if (!auth.ok) return auth.response;

  const csrfError = await requireCsrf(request, auth.user);
  if (csrfError) return csrfError;

  const body = await readJsonBody(request);
  const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const assertionInput = { subject: auth.user.id, displayName, roomId };
  const inputClassification = classifyAccountIdentityInput(assertionInput);
  if (inputClassification === "invalid") {
    return noStore(safeJson({
      ok: false,
      code: "invalid_identity_input",
      error: "Choose a valid room and a 3–20 character public display name.",
    }, 400));
  }
  if (inputClassification === "unsupported_room") {
    return noStore(safeJson({
      ok: false,
      code: "account_identity_room_unsupported",
      error: "This room uses a legacy identifier and will use guest registration.",
    }, 422));
  }

  const configuration = getAccountIdentityConfiguration();
  const exchangeUrl = getAccountIdentityExchangeUrl();
  if (!configuration.ready || !exchangeUrl) return unavailableResponse();

  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionValue) return unavailableResponse();

  const rateLimit = checkAccountIdentityRateLimit(auth.user.id);
  if (!rateLimit.allowed) {
    const response = noStore(safeJson({
      ok: false,
      code: "account_identity_rate_limited",
      error: "Too many quiz identity requests. Try again shortly.",
    }, 429));
    if (rateLimit.retryAfterSeconds) {
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    }
    return response;
  }

  let assertion: string;
  let sessionBinding: string;
  try {
    assertion = createAccountIdentityAssertion(assertionInput);
    sessionBinding = createAccountIdentitySessionBinding(sessionValue);
  } catch {
    return unavailableResponse();
  }

  try {
    const engineResponse = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ assertion }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await engineResponse.json().catch(() => null) as EngineIdentityResponse | null;

    if (!engineResponse.ok || !data?.ok) {
      const status = engineResponse.status === 429 ? 429
        : engineResponse.status === 404 ? 404
          : engineResponse.status === 409 ? 409
            : engineResponse.status >= 500 ? 503
              : 400;
      return noStore(safeJson({
        ok: false,
        code: data?.reason || "account_identity_exchange_failed",
        error: status === 429
          ? "Too many quiz identity requests. Try again shortly."
          : status === 409
            ? "That public display name is already in use."
            : "Account-linked quiz identity could not be created.",
      }, status));
    }

    if (
      data.identityType !== "account"
      || typeof data.userId !== "string"
      || !ENGINE_ACCOUNT_ID_PATTERN.test(data.userId)
      || typeof data.username !== "string"
      || !DISPLAY_NAME_PATTERN.test(data.username)
      || data.roomId !== roomId
      || typeof data.joinToken !== "string"
      || data.joinToken.length > 4096
      || !JOIN_TOKEN_PATTERN.test(data.joinToken)
    ) {
      return noStore(safeJson({
        ok: false,
        code: "invalid_engine_identity_response",
        error: "The quiz Engine returned an invalid identity response.",
      }, 502));
    }

    // Return only the normal room credential plus a one-way binding for this
    // browser session. The assertion, account subject, cookie, and shared
    // secret remain inside the server-to-server trust boundary.
    return noStore(safeJson({
      ok: true,
      identityType: "account",
      userId: data.userId,
      username: data.username,
      roomId: data.roomId,
      joinToken: data.joinToken,
      sessionBinding,
      identityCreated: data.identityCreated === true,
      displayNameAdjusted: data.displayNameAdjusted === true,
    }));
  } catch {
    return noStore(safeJson({
      ok: false,
      code: "account_identity_engine_unreachable",
      error: "The quiz Engine could not be reached.",
    }, 502));
  }
}
