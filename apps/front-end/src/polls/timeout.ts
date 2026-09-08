/** Reject a promise that does not settle in time. Used so a hung backend cannot block RPC. */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label = "TIMEOUT"): Promise<T> {
  if (timeoutMs <= 0) throw new Error(label);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export const HEALTH_TIMEOUT_MS = 4000;
export const BACKEND_TIMEOUT_MS = 4000;
export const SCHEDULE_REFRESH_MS = 15_000;

/** One deadline covers headers and the entire JSON body; cancel expired I/O. */
export async function fetchJsonWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<unknown> {
  if (timeoutMs <= 0) throw new Error("TIMEOUT");
  const controller = new AbortController();
  try {
    return await withTimeout(
      (async () => {
        const response = await fetchImpl(url, { method: "GET", signal: controller.signal });
        if (!response.ok) throw new Error("HTTP_ERROR");
        return await response.json();
      })(),
      timeoutMs,
    );
  } finally {
    controller.abort();
  }
}
