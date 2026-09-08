import type { PollSchedule } from "./schedule";

function backendOrigin(verifyEndpoint: string): string | null {
  try {
    const url = new URL(verifyEndpoint);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseBackendSchedule(body: unknown): PollSchedule | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (typeof value.pollAddress !== "string" || typeof value.startTime !== "string") return null;
  if (typeof value.endTime !== "string" || typeof value.blockHash !== "string") return null;
  if (typeof value.blockNumber !== "number" || !Number.isSafeInteger(value.blockNumber)) return null;
  if (
    value.status !== "OPEN" &&
    value.status !== "UPCOMING" &&
    value.status !== "CLOSED" &&
    value.status !== "INVALID_WINDOW"
  ) {
    return null;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value.pollAddress) || !/^(0|[1-9][0-9]{0,77})$/.test(value.startTime)) return null;
  if (!/^(0|[1-9][0-9]{0,77})$/.test(value.endTime)) return null;
  return {
    pollAddress: value.pollAddress,
    startTime: value.startTime,
    endTime: value.endTime,
    status: value.status,
    blockNumber: value.blockNumber,
    blockHash: value.blockHash,
  };
}

/** Prefer the backend schedule reader so the browser does not depend on RPC CORS. */
export async function readBackendSchedule(
  verifyEndpoint: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PollSchedule | null> {
  const origin = backendOrigin(verifyEndpoint);
  if (!origin) return null;
  try {
    const response = await fetchImpl(`${origin}/polls/configured`);
    if (!response.ok) return null;
    return parseBackendSchedule(await response.json());
  } catch {
    return null;
  }
}
