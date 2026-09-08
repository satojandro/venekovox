import { useCallback, useEffect, useRef, useState } from "react";
import { readBackendHealth, type BackendHealth } from "../lib/backendHealth";
import { readConfiguredDescriptor, viteDescriptorEnv, type PollDescriptor } from "./descriptor";
import { resolveConfiguredSchedule } from "./loadConfiguredPoll";
import { readPublicRpcUrl } from "./rpc";
import { SCHEDULE_REFRESH_MS } from "./timeout";
import type { PollSchedule } from "./schedule";

export type ConfiguredPollState =
  | { phase: "loading"; descriptor: PollDescriptor | null; health?: BackendHealth }
  | { phase: "ready"; descriptor: PollDescriptor; schedule: PollSchedule; health: BackendHealth }
  | { phase: "partial"; descriptor: PollDescriptor; scheduleError: string; health: BackendHealth }
  | { phase: "unconfigured" };

export type ConfiguredPollHook = ConfiguredPollState & {
  refresh: () => Promise<PollSchedule | null>;
};

function emptyHealth(): BackendHealth {
  return { status: "down" };
}

function withHealth(state: ConfiguredPollState, health: BackendHealth): ConfiguredPollState {
  if (state.phase === "unconfigured") return state;
  return { ...state, health };
}

function withSchedule(
  state: ConfiguredPollState,
  descriptor: PollDescriptor,
  lookup: { schedule: PollSchedule } | { error: string },
): ConfiguredPollState {
  const health = state.phase === "unconfigured" ? emptyHealth() : (state.health ?? emptyHealth());
  if ("schedule" in lookup) return { phase: "ready", descriptor, schedule: lookup.schedule, health };
  return { phase: "partial", descriptor, scheduleError: lookup.error, health };
}

export function useConfiguredPoll(): ConfiguredPollHook {
  const [state, setState] = useState<ConfiguredPollState>({
    phase: "loading",
    descriptor: readConfiguredDescriptor(viteDescriptorEnv()),
  });
  const refreshRef = useRef<() => Promise<PollSchedule | null>>(async () => null);

  const refresh = useCallback(async () => {
    return refreshRef.current();
  }, []);

  useEffect(() => {
    const descriptor = readConfiguredDescriptor(viteDescriptorEnv());
    if (!descriptor) {
      setState({ phase: "unconfigured" });
      refreshRef.current = async () => null;
      return;
    }

    let cancelled = false;
    let revision = 0;
    const rpcUrl = readPublicRpcUrl({
      VITE_PUBLIC_RPC_URL: import.meta.env.VITE_PUBLIC_RPC_URL,
      VITE_ENS_RPC_URL: import.meta.env.VITE_ENS_RPC_URL,
    });
    const verifyEndpoint = (import.meta.env.VITE_SELF_ENDPOINT as string | undefined) || "http://localhost:3100/verify";

    const loadSchedule = async (): Promise<PollSchedule | null> => {
      const mine = ++revision;
      const lookup = await resolveConfiguredSchedule({ descriptor, verifyEndpoint, rpcUrl });
      // Always return this request's window to the caller (vote recheck).
      // Only the latest request may write React state, so an in-flight interval
      // cannot hide a newer vote-time read or the reverse.
      if (!cancelled && mine === revision) {
        setState((current) => withSchedule(current, descriptor, lookup));
      }
      return "schedule" in lookup ? lookup.schedule : null;
    };

    refreshRef.current = loadSchedule;

    // Health is a status light only. Do not wait for it before reading the window.
    void readBackendHealth(verifyEndpoint).then((health) => {
      if (!cancelled) setState((current) => withHealth(current, health));
    });
    void loadSchedule();
    const timer = setInterval(() => {
      void loadSchedule();
    }, SCHEDULE_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { ...state, refresh };
}
