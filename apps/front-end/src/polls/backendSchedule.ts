import { getAddress } from "ethers";
import type { PollDescriptor } from "./descriptor";
import type { PollSchedule } from "./schedule";
import { BACKEND_TIMEOUT_MS, fetchJsonWithTimeout } from "./timeout";

function backendOrigin(verifyEndpoint: string): string | null {
  try {
    const url = new URL(verifyEndpoint);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function sameUint(left: string, right: string): boolean {
  try {
    return BigInt(left) === BigInt(right);
  } catch {
    return false;
  }
}

function sameAddress(left: string, right: string): boolean {
  try {
    return getAddress(left) === getAddress(right);
  } catch {
    return false;
  }
}

/** True only when the schedule names the same chain, MACI and poll as the UI. */
export function scheduleMatchesDescriptor(schedule: PollSchedule, descriptor: PollDescriptor): boolean {
  return (
    sameUint(schedule.chainId, descriptor.chainId) &&
    sameAddress(schedule.maciAddress, descriptor.maciAddress) &&
    sameUint(schedule.pollId, descriptor.pollId)
  );
}

/**
 * Fail closed when option count or voting mode do not match the operator
 * manifest. An unavailable field is not a match.
 */
export function scheduleFitsManifest(schedule: PollSchedule, descriptor: PollDescriptor): boolean {
  if (!scheduleMatchesDescriptor(schedule, descriptor)) return false;
  if (descriptor.expectedPollAddress && !sameAddress(schedule.pollAddress, descriptor.expectedPollAddress)) {
    return false;
  }
  if (!sameUint(schedule.voteOptions, String(descriptor.expectedVoteOptions))) return false;
  if (!sameUint(schedule.mode, String(descriptor.expectedMode))) return false;
  return true;
}

export function parseBackendSchedule(body: unknown): PollSchedule | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  if (typeof value.pollAddress !== "string" || typeof value.startTime !== "string") return null;
  if (typeof value.endTime !== "string" || typeof value.blockHash !== "string") return null;
  if (typeof value.maciAddress !== "string" || typeof value.pollId !== "string") return null;
  if (typeof value.chainId !== "string") return null;
  if (typeof value.voteOptions !== "string" || typeof value.mode !== "string") return null;
  if (typeof value.tallyAddress !== "string") return null;
  if (typeof value.blockNumber !== "number" || !Number.isSafeInteger(value.blockNumber)) return null;
  if (
    value.status !== "OPEN" &&
    value.status !== "UPCOMING" &&
    value.status !== "CLOSED" &&
    value.status !== "INVALID_WINDOW"
  ) {
    return null;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(value.pollAddress) || !/^0x[0-9a-fA-F]{40}$/.test(value.maciAddress)) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value.tallyAddress)) return null;
  if (!/^(0|[1-9][0-9]{0,77})$/.test(value.startTime) || !/^(0|[1-9][0-9]{0,77})$/.test(value.endTime)) return null;
  if (!/^(0|[1-9][0-9]{0,77})$/.test(value.pollId) || !/^(0|[1-9][0-9]{0,77})$/.test(value.chainId)) return null;
  if (!/^(0|[1-9][0-9]{0,77})$/.test(value.voteOptions) || !/^(0|[1-9][0-9]{0,77})$/.test(value.mode)) return null;
  try {
    return {
      chainId: value.chainId,
      maciAddress: getAddress(value.maciAddress),
      pollId: value.pollId,
      pollAddress: getAddress(value.pollAddress),
      tallyAddress: getAddress(value.tallyAddress),
      startTime: value.startTime,
      endTime: value.endTime,
      voteOptions: value.voteOptions,
      mode: value.mode,
      status: value.status,
      blockNumber: value.blockNumber,
      blockHash: value.blockHash,
    };
  } catch {
    return null;
  }
}

/**
 * Prefer the backend schedule reader so the browser does not depend on RPC CORS.
 * Returns null on timeout, HTTP failure, malformed body, identity mismatch,
 * or a deployment that does not match the operator manifest.
 */
export async function readBackendSchedule(
  verifyEndpoint: string,
  descriptor: PollDescriptor,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = BACKEND_TIMEOUT_MS,
): Promise<PollSchedule | null> {
  const origin = backendOrigin(verifyEndpoint);
  if (!origin) return null;
  try {
    const parsed = parseBackendSchedule(await fetchJsonWithTimeout(`${origin}/polls/configured`, fetchImpl, timeoutMs));
    if (!parsed || !scheduleFitsManifest(parsed, descriptor)) return null;
    return parsed;
  } catch {
    return null;
  }
}
