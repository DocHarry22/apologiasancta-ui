export const LIVE_SERVICE_REQUEST_TIMEOUT_MS = 45_000;
export const PUBLIC_ENGINE_READ_TIMEOUT_MS = 8_000;

export class RequestTimeoutError extends Error {
  constructor(message = "The live service did not respond in time. Please retry.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export type JsonFetchResult<T> =
  | { ok: false; response: Response; data?: T }
  | { ok: true; response: Response; data: T };

export async function fetchResponseWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = LIVE_SERVICE_REQUEST_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  let timedOut = false;

  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    return response;
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = LIVE_SERVICE_REQUEST_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<JsonFetchResult<T>> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  let timedOut = false;

  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    let data: T | undefined;
    try {
      data = await response.json() as T;
    } catch (error) {
      if (controller.signal.aborted) {
        throw controller.signal.reason ?? error;
      }
      if (response.ok) throw error;
    }
    if (!response.ok) return { ok: false, response, ...(data === undefined ? {} : { data }) };
    return { ok: true, response, data: data as T };
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
