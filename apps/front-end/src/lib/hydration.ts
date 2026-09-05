// Wallet hydration orchestration, separate from React.
//
// Every state write goes through `canApply()` at the moment of application.
// The sequence peeks first, then writes: a duplicate or stale run must not
// clear the displayed account/receipt and then return empty (G03).
//
// The hydrated-context marker is set only after participation lookup AND the
// receipt check attempt finish. Recheck of pending/unavailable receipts is a
// separate, guarded path in the hook.

import type { VoteReceipt } from "./receipts";
import type { ReceiptCheckResult, ReceiptCheckStatus } from "./receiptStatus";

export type WalletPeek =
  | { kind: "found"; account: string; chainId: bigint }
  | { kind: "no-provider" }
  | { kind: "not-connected" }
  | { kind: "error" };

export type KeyState =
  | { publicKey: string }
  | { missing: true }
  | { invalid: true }
  | { storageError: true };

export type HydrationWrite =
  | { type: "disconnected" }
  | { type: "probe-error" }
  | { type: "wrong-chain"; account: string }
  | { type: "checking"; account: string }
  | { type: "key-missing"; account: string }
  | { type: "key-invalid"; account: string }
  | { type: "key-storage-error"; account: string }
  | {
      type: "ready";
      account: string;
      registered: boolean;
      stateIndex?: string;
      pollStateIndex?: string;
    }
  | { type: "lookup-failed"; account: string; registered?: boolean }
  | { type: "receipt"; account: string; receipt: VoteReceipt; status: ReceiptCheckStatus };

export interface PollConfig {
  maciAddress: string;
  chainId: bigint;
  pollId: bigint;
}

export interface HydrationIO {
  canApply: () => boolean;
  contextKey: (chainId: bigint, account: string) => string;
  isHydratedFor: (key: string) => boolean;
  isInFlightFor: (key: string) => boolean;
  beginFlight: (key: string) => void;
  endFlight: (key: string) => void;
  markHydrated: (key: string) => void;
  clearHydrated: () => void;
  peekWallet: () => Promise<WalletPeek>;
  getConfig: () => PollConfig;
  readKey: () => KeyState;
  lookupParticipation: (args: {
    account: string;
    publicKey: string;
    maciAddress: string;
    pollId: bigint;
  }) => Promise<{ registered: boolean; stateIndex?: string; isJoined: boolean; pollStateIndex?: string }>;
  loadReceipt: (args: {
    chainId: bigint;
    maciAddress: string;
    pollId: bigint;
    account: string;
  }) => VoteReceipt | null;
  checkReceipt: (args: {
    txHash: string;
    maciAddress: string;
    pollId: bigint;
    account: string;
  }) => Promise<ReceiptCheckResult>;
  apply: (write: HydrationWrite) => void;
}

export function hydrationContextKey(chainId: bigint, account: string): string {
  return `${chainId}:${account.toLowerCase()}`;
}

export async function runHydration(io: HydrationIO): Promise<void> {
  const write = (next: HydrationWrite) => {
    if (io.canApply()) io.apply(next);
  };

  let peek: WalletPeek;
  try {
    peek = await io.peekWallet();
  } catch {
    write({ type: "probe-error" });
    return;
  }
  if (!io.canApply()) return;

  if (peek.kind === "no-provider" || peek.kind === "not-connected") {
    if (io.canApply()) {
      io.clearHydrated();
      io.apply({ type: "disconnected" });
    }
    return;
  }
  if (peek.kind === "error") {
    write({ type: "probe-error" });
    return;
  }

  const { account, chainId } = peek;

  let config: PollConfig;
  try {
    config = io.getConfig();
  } catch {
    write({ type: "lookup-failed", account });
    return;
  }

  if (chainId !== config.chainId) {
    write({ type: "wrong-chain", account });
    return;
  }

  const key = io.contextKey(chainId, account);
  if (io.isHydratedFor(key) || io.isInFlightFor(key)) return;

  io.beginFlight(key);
  try {
    // First write for this lookup: set the account. Never wipe receipts here —
    // a duplicate run must not blank a receipt it then skips restoring.
    write({ type: "checking", account });

    let keyState: KeyState;
    try {
      keyState = io.readKey();
    } catch {
      write({ type: "key-storage-error", account });
      return;
    }
    if ("storageError" in keyState) {
      write({ type: "key-storage-error", account });
      return;
    }
    if ("missing" in keyState) {
      write({ type: "key-missing", account });
      if (io.canApply()) io.markHydrated(key);
      return;
    }
    if ("invalid" in keyState) {
      write({ type: "key-invalid", account });
      if (io.canApply()) io.markHydrated(key);
      return;
    }

    let registered: boolean | undefined;
    try {
      const data = await io.lookupParticipation({
        account,
        publicKey: keyState.publicKey,
        maciAddress: config.maciAddress,
        pollId: config.pollId,
      });
      registered = data.registered;
      if (!io.canApply()) return;
      write({
        type: "ready",
        account,
        registered: data.registered,
        stateIndex: data.stateIndex,
        pollStateIndex: data.isJoined ? data.pollStateIndex : undefined,
      });
    } catch {
      write({ type: "lookup-failed", account, registered });
      return;
    }

    try {
      const stored = io.loadReceipt({
        chainId,
        maciAddress: config.maciAddress,
        pollId: config.pollId,
        account,
      });
      if (stored) {
        let status: ReceiptCheckStatus = "unavailable";
        try {
          const result = await io.checkReceipt({
            txHash: stored.txHash,
            maciAddress: config.maciAddress,
            pollId: config.pollId,
            account,
          });
          status = result.status;
        } catch {
          status = "unavailable";
        }
        write({ type: "receipt", account, receipt: stored, status });
      }
      // Missing or unreadable storage must not erase an in-memory receipt from
      // a submission that already succeeded in this session.
    } catch {
      // Same: participation stands; leave any displayed receipt untouched.
    }

    if (io.canApply()) io.markHydrated(key);
  } finally {
    io.endFlight(key);
  }
}
