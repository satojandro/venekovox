import type { PollDescriptor } from "./descriptor";
import { readBackendSchedule, scheduleFitsManifest } from "./backendSchedule";
import { createReadProvider } from "./rpc";
import { readPollSchedule, ScheduleError, type PollSchedule, type ScheduleProvider } from "./schedule";
import { BACKEND_TIMEOUT_MS } from "./timeout";

export type ScheduleLookup = { schedule: PollSchedule } | { error: string };

export type ResolveScheduleDeps = {
  descriptor: PollDescriptor;
  verifyEndpoint: string;
  rpcUrl: string | null;
  fetchImpl?: typeof fetch;
  backendTimeoutMs?: number;
  readRpcSchedule?: (
    provider: ScheduleProvider,
    maciAddress: string,
    pollId: string,
    chainId: string,
  ) => Promise<PollSchedule>;
  createProvider?: (rpcUrl: string) => ScheduleProvider;
};

/**
 * Backend first (with a deadline), then direct RPC. Identity mismatch is a miss,
 * not a ready schedule for the wrong poll.
 */
export async function resolveConfiguredSchedule(deps: ResolveScheduleDeps): Promise<ScheduleLookup> {
  const {
    descriptor,
    verifyEndpoint,
    rpcUrl,
    fetchImpl = fetch,
    backendTimeoutMs = BACKEND_TIMEOUT_MS,
    readRpcSchedule = readPollSchedule,
    createProvider = createReadProvider,
  } = deps;

  const fromBackend = await readBackendSchedule(verifyEndpoint, descriptor, fetchImpl, backendTimeoutMs);
  if (fromBackend) return { schedule: fromBackend };

  if (!rpcUrl) return { error: "NOT_CONFIGURED" };
  try {
    const schedule = await readRpcSchedule(
      createProvider(rpcUrl),
      descriptor.maciAddress,
      descriptor.pollId,
      descriptor.chainId,
    );
    if (!scheduleFitsManifest(schedule, descriptor)) return { error: "POLL_MISMATCH" };
    return { schedule };
  } catch (error) {
    return { error: error instanceof ScheduleError ? error.code : "LOOKUP_FAILED" };
  }
}
