import { getAddress, ZeroAddress } from "ethers";
import type { ProfileTheme } from "./ensv2";
import { isProfileTheme, SEPOLIA_ENSV2 } from "./ensv2";

export type ProfilePhase = "none" | "incomplete" | "ready";
export type SetupOp = "deployResolver" | "claimProfile" | "writeRecords" | "authorizeTheme";

export interface ProfileSetup {
  phase: ProfilePhase;
  account: string;
  name: string;
  label: string;
  predictedResolver: string;
  actualResolver: string;
  forwardAddr: string;
  theme: ProfileTheme | "";
  nextOp: SetupOp | null;
}

export function classifyProfileSetup(input: {
  account: string;
  claimedName: string;
  predictedResolver: string;
  actualResolver: string;
  forwardAddr: string;
  theme: string;
  resolverCode: boolean;
}): ProfileSetup {
  const account = getAddress(input.account);
  const predicted = input.predictedResolver ? getAddress(input.predictedResolver) : ZeroAddress;
  const actual =
    input.actualResolver && input.actualResolver !== ZeroAddress ? getAddress(input.actualResolver) : ZeroAddress;
  const forward = input.forwardAddr && input.forwardAddr !== ZeroAddress ? getAddress(input.forwardAddr) : ZeroAddress;
  const theme: ProfileTheme | "" = isProfileTheme(input.theme) ? input.theme : "";
  const name = input.claimedName;
  const label = name ? name.split(".")[0] : "";
  const base: Omit<ProfileSetup, "phase" | "nextOp"> = {
    account,
    name,
    label,
    predictedResolver: predicted,
    actualResolver: actual,
    forwardAddr: forward,
    theme,
  };
  if (!name) {
    return {
      ...base,
      phase: "none",
      nextOp: input.resolverCode ? "claimProfile" : "deployResolver",
    };
  }
  const resolverOk = actual === predicted && predicted !== ZeroAddress;
  const addrOk = forward === account;
  if (resolverOk && addrOk) {
    return { ...base, phase: "ready", nextOp: null };
  }
  let nextOp: SetupOp = "writeRecords";
  if (!input.resolverCode) nextOp = "deployResolver";
  else if (!resolverOk) nextOp = "writeRecords";
  return { ...base, phase: "incomplete", nextOp };
}

export function themeClassName(theme: string): string {
  if (theme === "rose") return "profile-theme-rose";
  if (theme === "slate") return "profile-theme-slate";
  return "profile-theme-lime";
}

/** Hide another wallet's profile on the first render after an account switch. */
export function visibleProfileSetup(setup: ProfileSetup | null, account?: string | null): ProfileSetup | null {
  if (!setup || !account) return null;
  try {
    return getAddress(setup.account) === getAddress(account) ? setup : null;
  } catch {
    return null;
  }
}

export function lookupView(
  setup: ProfileSetup | null,
  account?: string | null,
  loading = false,
): { setup: ProfileSetup | null; loading: boolean } {
  const visible = visibleProfileSetup(setup, account);
  const stale = Boolean(account && setup && !visible);
  return { setup: visible, loading: loading || stale };
}

export const UNIVERSAL_RESOLVER = SEPOLIA_ENSV2.UniversalResolver;
