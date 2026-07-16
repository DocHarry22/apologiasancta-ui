import type { NextRequest } from "next/server";
import {
  createAccountIdentityAssertion,
  getAccountIdentityConfiguration,
  getAccountIdentityExchangeUrl,
  isValidAccountIdentityInput,
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

function unavailableResponse() {
  return safeJson({
    ok: false,
    code: "account_identity_unavailable",
    error: "Account-linked quiz identity is not available.",
  }, 503);
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
  if (!isValidAccountIdentityInput(assertionInput)) {
    return safeJson({
      ok: false,
      code: "invalid_identity_input",
      error: "Choose a valid room and a 3–20 character public display name.",
    }, 400);
  }

  const configuration = getAccountIdentityConfiguration();
  const exchangeUrl = getAccountIdentityExchangeUrl();
  if (!configuration.ready || !exchangeUrl) return unavailableResponse();

  let assertion: string;
  try {
    assertion = createAccountIdentityAssertion(assertionInput);
  } catch {
    return unavailableResponse();
  }

  try {
    const engineResponse = await fetch(exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assertion }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await engineResponse.json().catch(() => null) as EngineIdentityResponse | null;

    if (!engineResponse.ok || !data?.ok) {
      const status = engineResponse.status === 429 ? 429
        : engineResponse.status === 404 ? 404
          : engineResponse.status === 409 ? 409
            : engineResponse.status >= 500 ? 503
              : 400;
      return safeJson({
        ok: false,
        code: data?.reason || "account_identity_exchange_failed",
        error: status === 429
          ? "Too many quiz identity requests. Try again shortly."
          : status === 409
            ? "That public display name is already in use."
            : "Account-linked quiz identity could not be created.",
      }, status);
    }

    if (
      data.identityType !== "account"
      || typeof data.userId !== "string"
      || typeof data.username !== "string"
      || typeof data.roomId !== "string"
      || typeof data.joinToken !== "string"
      || !data.joinToken
    ) {
      return safeJson({
        ok: false,
        code: "invalid_engine_identity_response",
        error: "The quiz Engine returned an invalid identity response.",
      }, 502);
    }

    // Return only the normal room credential. The signed assertion and shared
    // secret remain inside this server-to-server request.
    return safeJson({
      ok: true,
      identityType: "account",
      userId: data.userId,
      username: data.username,
      roomId: data.roomId,
      joinToken: data.joinToken,
      identityCreated: data.identityCreated === true,
      displayNameAdjusted: data.displayNameAdjusted === true,
    });
  } catch {
    return safeJson({
      ok: false,
      code: "account_identity_engine_unreachable",
      error: "The quiz Engine could not be reached.",
    }, 502);
  }
}
