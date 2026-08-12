/** Detect browser/network fetch failures (not HTTP 4xx/5xx). */
export function isNetworkFetchError(err: unknown): boolean {
  if (err instanceof TypeError) {
    const msg = err.message;
    return (
      msg === "Failed to fetch" ||
      msg === "NetworkError when attempting to fetch resource." ||
      msg === "Load failed"
    );
  }
  return err instanceof Error && err.name === "UploadNetworkError";
}

/** Retry transient client-side fetch failures (mobile radio blips, proxy resets). */
export async function fetchWithNetworkRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: { retries?: number; baseDelayMs?: number }
): Promise<Response> {
  const retries = opts?.retries ?? 2;
  const baseDelayMs = opts?.baseDelayMs ?? 400;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (!isNetworkFetchError(err) || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
