import { fetchJsonWithTimeout, fetchResponseWithTimeout } from "./fetchWithTimeout";

export const ACCOUNT_ACCESS_REQUEST_TIMEOUT_MS = 15_000;

export function fetchAccountAccessJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  return fetchJsonWithTimeout<T>(input, init, ACCOUNT_ACCESS_REQUEST_TIMEOUT_MS);
}

export function fetchAccountAccessResponse(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  return fetchResponseWithTimeout(input, init, ACCOUNT_ACCESS_REQUEST_TIMEOUT_MS);
}
