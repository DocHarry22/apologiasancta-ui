export const LIVE_SERVICE_REQUEST_TIMEOUT_MS = 45_000;

export class RequestTimeoutError extends Error {
  constructor(message = "The live service did not respond in time. Please retry.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export async function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = LIVE_SERVICE_REQUEST_TIMEOUT_MS,
): Promise<{ response: Response; data: T }> {
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
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? new DOMException("Aborted", "AbortError");
    }
    const data = await response.json() as T;
    return { response, data };
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
