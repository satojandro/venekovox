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
  const theme = isProfileTheme(input.theme) ? input.theme : "";
  const name = input.claimedName;
  const label = name ? name.split(".")[0] : "";
  const base = {
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
  if (theme === "rose") return "text-rose-300";
  if (theme === "slate") return "text-slate-300";
  return "text-lime-300";
}

export const UNIVERSAL_RESOLVER = SEPOLIA_ENSV2.UniversalResolver;
