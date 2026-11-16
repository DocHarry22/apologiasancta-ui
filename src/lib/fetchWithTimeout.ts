export const LIVE_SERVICE_REQUEST_TIMEOUT_MS = 45_000;

export class RequestTimeoutError extends Error {
  constructor(message = "The live service did not respond in time. Please retry.") {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = LIVE_SERVICE_REQUEST_TIMEOUT_MS,
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
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}
