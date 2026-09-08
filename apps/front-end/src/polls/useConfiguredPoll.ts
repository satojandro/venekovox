import { useEffect, useState } from "react";
import { readBackendHealth, type BackendHealth } from "../lib/backendHealth";
import { readBackendSchedule } from "./backendSchedule";
import { readConfiguredDescriptor, viteDescriptorEnv, type PollDescriptor } from "./descriptor";
import { createReadProvider, readPublicRpcUrl } from "./rpc";
import { readPollSchedule, ScheduleError, type PollSchedule } from "./schedule";

export type ConfiguredPollState =
  | { phase: "loading"; descriptor: PollDescriptor | null; health?: BackendHealth }
  | { phase: "ready"; descriptor: PollDescriptor; schedule: PollSchedule; health: BackendHealth }
  | { phase: "partial"; descriptor: PollDescriptor; scheduleError: string; health: BackendHealth }
  | { phase: "unconfigured" };

export function useConfiguredPoll(): ConfiguredPollState {
  const [state, setState] = useState<ConfiguredPollState>({
    phase: "loading",
    descriptor: readConfiguredDescriptor(viteDescriptorEnv()),
  });

  useEffect(() => {
    const descriptor = readConfiguredDescriptor(viteDescriptorEnv());
    if (!descriptor) {
      setState({ phase: "unconfigured" });
      return;
    }

    let cancelled = false;
    const rpc = readPublicRpcUrl({
      VITE_PUBLIC_RPC_URL: import.meta.env.VITE_PUBLIC_RPC_URL,
      VITE_ENS_RPC_URL: import.meta.env.VITE_ENS_RPC_URL,
    });
    const verifyEndpoint = (import.meta.env.VITE_SELF_ENDPOINT as string | undefined) || "http://localhost:3100/verify";

    const load = async () => {
      const health = await readBackendHealth(verifyEndpoint);
      if (cancelled) return;
      setState({ phase: "loading", descriptor, health });

      const fromBackend = await readBackendSchedule(verifyEndpoint);
      if (cancelled) return;
      if (fromBackend) {
        setState({ phase: "ready", descriptor, schedule: fromBackend, health });
        return;
      }
      if (!rpc) {
        setState({ phase: "partial", descriptor, scheduleError: "NOT_CONFIGURED", health });
        return;
      }
      try {
        const schedule = await readPollSchedule(createReadProvider(rpc), descriptor.maciAddress, descriptor.pollId);
        if (!cancelled) setState({ phase: "ready", descriptor, schedule, health });
      } catch (error) {
        const code = error instanceof ScheduleError ? error.code : "LOOKUP_FAILED";
        if (!cancelled) setState({ phase: "partial", descriptor, scheduleError: code, health });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
