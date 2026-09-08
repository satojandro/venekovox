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
): Promise<BackendHealth> {
  const url = healthUrl(verifyEndpoint);
  if (!url) return { status: "invalid" };
  try {
    const response = await fetchImpl(url, { method: "GET" });
    if (!response.ok) return { status: "down" };
    const body = (await response.json()) as { status?: string; service?: string };
    if (body.status !== "healthy") return { status: "down" };
    return { status: "ok", service: body.service };
  } catch {
    return { status: "down" };
  }
}
