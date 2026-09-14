// JSON-only requests: the deadline includes reading the response body.
export async function requestJson<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const signal = options.signal;
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json() as T;
    return { response, data };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
