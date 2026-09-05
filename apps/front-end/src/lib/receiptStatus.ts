// On-chain verification of a stored submission receipt.
//
// A stored record is evidence of INTENT, not confirmation. Only the chain can
// say whether the transaction was mined, whether it succeeded, and whether it
// published a message to THIS poll. Votes are sent to the Poll contract
// (`publishMessage`), not to MACI; a successful MACI signup is not a vote.
// Even a confirmed publication is still NOT a counted vote — counting is the
// tally's domain (P4) and this module never claims it.
//
// Indirect execution (smart accounts / entry points) may set `receipt.to` to
// something other than the Poll. Confirmation therefore requires the Poll's
// PublishMessage event (or equivalent log), plus participating-account context
// on `from`, `to`, or an address-bearing log. Full ERC-4337 semantics remain W1.
//
// The provider interface is deliberately minimal so the decision logic can be
// unit-tested without a network or a React harness.

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;
const ZERO_ADDRESS = "0x" + "0".repeat(40);

// keccak256("getPoll(uint256)") — first 4 bytes. MACI returns (poll, processor, tally).
export const GET_POLL_SELECTOR = "0x1a8cbcaa";

// keccak256("PublishMessage((uint256[10]),(uint256,uint256))")
export const PUBLISH_MESSAGE_TOPIC =
  "0x4be9ef9ae736055964ead1cf3c83a19c8b662b5df2bd4414776bb64d81f75d15";

function isValidTxHash(value: string): boolean {
  return TX_HASH_RE.test(value);
}

function isAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

function norm(addr: string): string {
  return addr.toLowerCase();
}

/** 32-byte left-padded address, as indexed event topics encode addresses. */
export function paddedAddressTopic(account: string): string {
  return "0x" + account.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
}

export function encodeGetPollCall(pollId: bigint): string {
  const id = pollId < 0n ? 0n : pollId;
  return GET_POLL_SELECTOR + id.toString(16).padStart(64, "0");
}

/** Decode the poll address from ABI-encoded `getPoll` return data. */
export function decodePollAddress(data: string): string | null {
  const hex = data.startsWith("0x") || data.startsWith("0X") ? data.slice(2) : data;
  if (hex.length < 64 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  const addr = "0x" + hex.slice(24, 64);
  if (!ADDRESS_RE.test(addr) || norm(addr) === ZERO_ADDRESS) return null;
  return addr;
}

export type ReceiptCheckStatus =
  | "unverified" // no check performed or possible yet (e.g. just submitted)
  | "pending" // transaction not found yet — may be unmined, or unavailable
  | "confirmed" // mined, succeeded, published to the resolved Poll, matching account
  | "unexpected" // mined and succeeded, but not a publication for this poll/account
  | "reverted" // mined and failed
  | "unavailable"; // the chain did not answer — we do NOT know (never "failed")

export const RECHECKABLE_STATUSES: readonly ReceiptCheckStatus[] = [
  "unverified",
  "pending",
  "unavailable",
  "unexpected",
];

export function isRecheckable(status: ReceiptCheckStatus | null | undefined): boolean {
  return status != null && RECHECKABLE_STATUSES.includes(status);
}

export interface ReceiptCheckResult {
  status: ReceiptCheckStatus;
  /** True when a PublishMessage log was emitted by the resolved Poll. */
  pollMatch: boolean;
  /** True when the participating account appears in the execution context. */
  accountMatch: boolean;
  /** Recipient address as reported by the chain, if any. */
  to?: string | null;
  /** Poll address resolved from MACI.getPoll, if resolution succeeded. */
  pollAddress?: string;
}

export interface ReceiptLog {
  address?: string | null;
  topics?: readonly string[] | null;
}

export interface ChainReceipt {
  status?: number | null;
  to?: string | null;
  from?: string | null;
  logs?: readonly ReceiptLog[] | null;
}

export interface ReceiptProvider {
  getTransactionReceipt(hash: string): Promise<ChainReceipt | null>;
  /** eth_call. Used to resolve the poll address from MACI.getPoll. */
  call(to: string, data: string): Promise<string>;
}

export function accountMatchesReceipt(receipt: ChainReceipt, account: string): boolean {
  if (!isAddress(account)) return false;
  const expected = norm(account);
  if (receipt.from && isAddress(receipt.from) && norm(receipt.from) === expected) return true;
  // Smart-account outer tx: the account is the recipient that then calls Poll.
  if (receipt.to && isAddress(receipt.to) && norm(receipt.to) === expected) return true;
  const topic = paddedAddressTopic(account);
  for (const log of receipt.logs ?? []) {
    if (log.address && isAddress(log.address) && norm(log.address) === expected) return true;
    for (const item of log.topics ?? []) {
      if (typeof item === "string" && item.toLowerCase() === topic) return true;
    }
  }
  return false;
}

export function hasPublishMessageFrom(receipt: ChainReceipt, pollAddress: string): boolean {
  if (!isAddress(pollAddress)) return false;
  const poll = norm(pollAddress);
  const topic = PUBLISH_MESSAGE_TOPIC.toLowerCase();
  for (const log of receipt.logs ?? []) {
    if (!log.address || !isAddress(log.address) || norm(log.address) !== poll) continue;
    const first = log.topics?.[0];
    if (typeof first === "string" && first.toLowerCase() === topic) return true;
  }
  return false;
}

export async function resolvePollAddress(args: {
  provider: Pick<ReceiptProvider, "call">;
  maciAddress: string;
  pollId: bigint;
}): Promise<string | null> {
  if (!isAddress(args.maciAddress)) return null;
  try {
    const data = await args.provider.call(args.maciAddress, encodeGetPollCall(args.pollId));
    return decodePollAddress(data);
  } catch {
    return null;
  }
}

export async function checkReceiptStatus(args: {
  provider: ReceiptProvider;
  txHash: string;
  maciAddress: string;
  pollId: bigint;
  account: string;
}): Promise<ReceiptCheckResult> {
  const { provider, txHash, maciAddress, pollId, account } = args;
  if (!isValidTxHash(txHash)) {
    return { status: "unverified", pollMatch: false, accountMatch: false };
  }

  let receipt: ChainReceipt | null;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    // RPC failure: not knowing must never be presented as a failed vote.
    return { status: "unavailable", pollMatch: false, accountMatch: false };
  }

  if (!receipt) {
    // Not found means unmined (or still propagating), never "failed".
    return { status: "pending", pollMatch: false, accountMatch: false };
  }

  const to = receipt.to ?? null;
  const accountMatch = accountMatchesReceipt(receipt, account);

  if (receipt.status === 0) {
    // Reverts are classified from status alone. Poll resolution is best-effort.
    const pollAddress = (await resolvePollAddress({ provider, maciAddress, pollId })) ?? undefined;
    const toIsPoll = !!(pollAddress && to && isAddress(to) && norm(to) === norm(pollAddress));
    const pollMatch = pollAddress ? hasPublishMessageFrom(receipt, pollAddress) || toIsPoll : false;
    return { status: "reverted", pollMatch, accountMatch, to, pollAddress };
  }

  if (receipt.status !== 1) {
    // Status absent (pre-EIP-658 receipts) carries no success signal: stay pending
    // rather than guessing.
    return { status: "pending", pollMatch: false, accountMatch, to };
  }

  const pollAddress = await resolvePollAddress({ provider, maciAddress, pollId });
  if (!pollAddress) {
    // Without the expected Poll we cannot tell a vote apart from any other success.
    return { status: "unavailable", pollMatch: false, accountMatch, to };
  }

  const pollMatch = hasPublishMessageFrom(receipt, pollAddress);
  if (pollMatch && accountMatch) {
    return { status: "confirmed", pollMatch: true, accountMatch: true, to, pollAddress };
  }
  return { status: "unexpected", pollMatch, accountMatch, to, pollAddress };
}
