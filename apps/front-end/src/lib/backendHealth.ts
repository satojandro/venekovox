import { HEALTH_TIMEOUT_MS, fetchJsonWithTimeout } from "../polls/timeout";

export type BackendHealth = {
  status: "ok" | "down" | "invalid";
  service?: string;
};

function healthUrl(verifyEndpoint: string): string | null {
  try {
    const url = new URL(verifyEndpoint);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return new URL("/health", url.origin).toString();
  } catch {
    return null;
  }
}

/** Read-only ping of the Express `/health` route. Does not call `/verify`. */
export async function readBackendHealth(
  verifyEndpoint: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<BackendHealth> {
  const url = healthUrl(verifyEndpoint);
  if (!url) return { status: "invalid" };
  try {
    const body = (await fetchJsonWithTimeout(url, fetchImpl, timeoutMs)) as { status?: string; service?: string };
    if (body.status !== "healthy") return { status: "down" };
    return { status: "ok", service: body.service };
  } catch {
    return { status: "down" };
  }
}
