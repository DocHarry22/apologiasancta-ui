import {
  fetchJsonWithTimeout,
  fetchResponseWithTimeout,
  type JsonFetchResult,
} from "@/lib/fetchWithTimeout";

/**
 * Browser requests to Apologia Sancta's own authenticated routes must not leave
 * controls permanently busy when a connection or response body stalls.
 */
export const FIRST_PARTY_REQUEST_TIMEOUT_MS = 20_000;

export function fetchFirstPartyResponse(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetchResponseWithTimeout(input, init, FIRST_PARTY_REQUEST_TIMEOUT_MS);
}

export function fetchFirstPartyJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<JsonFetchResult<T>> {
  return fetchJsonWithTimeout<T>(input, init, FIRST_PARTY_REQUEST_TIMEOUT_MS);
}
