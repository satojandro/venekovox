// Wallet hydration orchestration, separate from React.
//
// Every state write goes through `canApply()` AND a captured operation id.
// Increment the operation id when a submission starts so a delayed RPC from
// an older hydration cannot overwrite a newer receipt (G03).
// The sequence peeks first, then writes: a duplicate or stale run must not
// clear the displayed account/receipt and then return empty.
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

export type KeyState = { publicKey: string } | { missing: true } | { invalid: true } | { storageError: true };

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

/**
 * Ownership token for the in-flight hydration lock.
 *
 * A lock is (context key, owning operation id). Cleanup releases the lock only
 * when the *same run that acquired it* is finishing: an older run's `finally`
 * must never clear a newer run's lock. When a submission starts it calls
 * `invalidateFlight`, so an older run that can no longer apply (its operation
 * id is stale) cannot leave the account permanently "in flight".
 */
export interface FlightAnchor {
  key: string | null;
  owner: number | null;
}

export function createFlightAnchor(): FlightAnchor {
  return { key: null, owner: null };
}

/** True when another hydration holds the lock for this context. */
export function isFlightHeld(anchor: FlightAnchor, key: string): boolean {
  return anchor.key === key;
}

/** THIS run (`owner`) acquired the lock for `key`. */
export function beginFlight(anchor: FlightAnchor, key: string, owner: number): void {
  anchor.key = key;
  anchor.owner = owner;
}

/** Release the lock ONLY if this exact run still owns it. */
export function endFlight(anchor: FlightAnchor, key: string, owner: number): void {
  if (anchor.key !== key) return;
  if (anchor.owner !== owner) return;
  anchor.key = null;
  anchor.owner = null;
}

/** A new submission invalidates whatever lock an older hydration held. */
export function invalidateFlight(anchor: FlightAnchor): void {
  anchor.key = null;
  anchor.owner = null;
}

export interface HydrationIO {
  canApply: () => boolean;
  /** Monotonic id. Increment when a submission starts so older hydrations cannot apply later. */
  getOperationId: () => number;
  /** Persistent per-session ownership anchor for the in-flight lock. */
  flightAnchor: () => FlightAnchor;
  /** In-memory receipt for the live session, if any. Used so storage cannot clobber a newer submit. */
  liveReceipt: () => VoteReceipt | null;
  contextKey: (chainId: bigint, account: string) => string;
  isHydratedFor: (key: string) => boolean;
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
  loadReceipt: (args: { chainId: bigint; maciAddress: string; pollId: bigint; account: string }) => VoteReceipt | null;
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
  const operationId = io.getOperationId();
  const anchor = io.flightAnchor();
  const current = () => io.canApply() && io.getOperationId() === operationId;
  const write = (next: HydrationWrite) => {
    if (!current()) return;
    if (next.type === "receipt") {
      const live = io.liveReceipt();
      if (live && live.txHash.toLowerCase() !== next.receipt.txHash.toLowerCase()) return;
    }
    io.apply(next);
  };

  let peek: WalletPeek;
  try {
    peek = await io.peekWallet();
  } catch {
    write({ type: "probe-error" });
    return;
  }
  if (!current()) return;

  if (peek.kind === "no-provider" || peek.kind === "not-connected") {
    if (current()) {
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
  if (io.isHydratedFor(key) || isFlightHeld(anchor, key)) return;
  // A run that went stale while peeking must not grab the lock: if it did, its
  // cleanup could never release it (the operation it captured is no longer the
  // current one), which would leave the account permanently "in flight".
  if (!current()) return;

  beginFlight(anchor, key, operationId);
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
      if (current()) io.markHydrated(key);
      return;
    }
    if ("invalid" in keyState) {
      write({ type: "key-invalid", account });
      if (current()) io.markHydrated(key);
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
      if (!current()) return;
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

    if (current()) io.markHydrated(key);
  } finally {
    endFlight(anchor, key, operationId);
  }
}
