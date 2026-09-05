// On-chain verification of a stored submission receipt.
//
// A stored record is evidence of INTENT, not confirmation. Only the chain can
// say whether the transaction was mined, whether it succeeded, and whether it
// published a message to THIS poll. Votes are sent to the Poll contract
// (`publishMessage`), not to MACI; a successful MACI signup is not a vote.
// Even a confirmed publication is still NOT a counted vote — counting is the
// tally's domain (P4) and this module never claims it.
//
// P1 confirms the direct-EOA path only: the participating account called
// publishMessage(Batch) on the resolved Poll, and that Poll emitted
// PublishMessage. The Poll constructor also emits PublishMessage for a
// placeholder leaf — event presence alone is not a vote. Unknown indirect
// execution (smart accounts / EntryPoint / sponsored bundles) stays
// "unverified". Same account address does not mean the same transaction shape:
// a relayer can preserve msg.sender while failing the from/to/calldata checks.
// W1 must use the sponsored-execution verifier in lib/sponsored/verifier.ts —
// do not relax this module back to generic log matching.
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

// keccak256("publishMessage((uint256[10]),(uint256,uint256))")
export const PUBLISH_MESSAGE_SELECTOR = "0x27bea0da";

// keccak256("publishMessageBatch((uint256[10])[],(uint256,uint256)[])")
export const PUBLISH_MESSAGE_BATCH_SELECTOR = "0x623f54ac";

function isValidTxHash(value: string): boolean {
  return TX_HASH_RE.test(value);
}

function isAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

function norm(addr: string): string {
  return addr.toLowerCase();
}

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && isAddress(a) && isAddress(b) && norm(a) === norm(b);
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

function callSelector(data: string | null | undefined): string | null {
  if (!data) return null;
  const hex = data.startsWith("0x") || data.startsWith("0X") ? data.slice(2) : data;
  if (hex.length < 8 || !/^[0-9a-fA-F]+$/.test(hex)) return null;
  return "0x" + hex.slice(0, 8).toLowerCase();
}

/** True when calldata is Poll.publishMessage or publishMessageBatch. */
export function isPublishCalldata(data: string | null | undefined): boolean {
  const selector = callSelector(data);
  return selector === PUBLISH_MESSAGE_SELECTOR || selector === PUBLISH_MESSAGE_BATCH_SELECTOR;
}

export type ReceiptCheckStatus =
  | "unverified" // no check performed, or execution is not the supported direct path
  | "pending" // transaction not found yet — may be unmined, or unavailable
  | "confirmed" // mined, succeeded, direct EOA publish to the resolved Poll
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
  /** True when the tx `from` is the participating account (direct EOA). */
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
  contractAddress?: string | null;
  logs?: readonly ReceiptLog[] | null;
}

export interface ChainTransaction {
  to?: string | null;
  from?: string | null;
  data?: string | null;
}

export interface ReceiptProvider {
  getTransactionReceipt(hash: string): Promise<ChainReceipt | null>;
  getTransaction(hash: string): Promise<ChainTransaction | null>;
  /** eth_call. Used to resolve the poll address from MACI.getPoll. */
  call(to: string, data: string): Promise<string>;
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

function hasPublishMessageFromOtherPoll(receipt: ChainReceipt, pollAddress: string): boolean {
  const topic = PUBLISH_MESSAGE_TOPIC.toLowerCase();
  const ours = isAddress(pollAddress) ? norm(pollAddress) : null;
  for (const log of receipt.logs ?? []) {
    if (!log.address || !isAddress(log.address)) continue;
    if (ours && norm(log.address) === ours) continue;
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

function isContractCreation(receipt: ChainReceipt, tx: ChainTransaction): boolean {
  if (receipt.contractAddress && isAddress(receipt.contractAddress)) return true;
  return !tx.to && !receipt.to;
}

export function isDirectEoaPublication(args: {
  receipt: ChainReceipt;
  tx: ChainTransaction;
  pollAddress: string;
  account: string;
}): boolean {
  const { receipt, tx, pollAddress, account } = args;
  return (
    sameAddress(tx.to, pollAddress) &&
    sameAddress(tx.from, account) &&
    isPublishCalldata(tx.data) &&
    hasPublishMessageFrom(receipt, pollAddress)
  );
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

  if (receipt.status === 0) {
    const pollAddress = (await resolvePollAddress({ provider, maciAddress, pollId })) ?? undefined;
    let tx: ChainTransaction | null = null;
    try {
      tx = await provider.getTransaction(txHash);
    } catch {
      tx = null;
    }
    const from = tx?.from ?? receipt.from;
    const to = tx?.to ?? receipt.to ?? null;
    return {
      status: "reverted",
      pollMatch: pollAddress ? hasPublishMessageFrom(receipt, pollAddress) || sameAddress(to, pollAddress) : false,
      accountMatch: sameAddress(from, account),
      to,
      pollAddress,
    };
  }

  if (receipt.status !== 1) {
    // Status absent (pre-EIP-658 receipts) carries no success signal: stay pending
    // rather than guessing.
    return { status: "pending", pollMatch: false, accountMatch: sameAddress(receipt.from, account), to: receipt.to };
  }

  let tx: ChainTransaction | null;
  try {
    tx = await provider.getTransaction(txHash);
  } catch {
    return { status: "unavailable", pollMatch: false, accountMatch: false, to: receipt.to };
  }
  if (!tx) {
    return { status: "unavailable", pollMatch: false, accountMatch: false, to: receipt.to };
  }

  const pollAddress = await resolvePollAddress({ provider, maciAddress, pollId });
  if (!pollAddress) {
    // Without the expected Poll we cannot tell a vote apart from any other success.
    return { status: "unavailable", pollMatch: false, accountMatch: sameAddress(tx.from, account), to: tx.to };
  }

  const pollMatch = hasPublishMessageFrom(receipt, pollAddress);
  const accountMatch = sameAddress(tx.from, account);
  const to = tx.to ?? receipt.to ?? null;

  if (isDirectEoaPublication({ receipt, tx, pollAddress, account })) {
    return { status: "confirmed", pollMatch: true, accountMatch: true, to, pollAddress };
  }

  // Known non-votes on the direct path, including constructor placeholder events
  // and a publish to a different poll.
  if (isContractCreation(receipt, tx)) {
    return { status: "unexpected", pollMatch, accountMatch, to, pollAddress };
  }
  if (sameAddress(to, pollAddress) || sameAddress(to, maciAddress) || hasPublishMessageFromOtherPoll(receipt, pollAddress)) {
    return { status: "unexpected", pollMatch, accountMatch, to, pollAddress };
  }

    // Unknown target (EntryPoint / smart account). Do not guess and do not fall
  // back to log-topic matching. W1's sponsored verifier in sponsored/verifier.ts
  // is a separate checker: it needs managed ids + user-op success + inner evidence.
  return { status: "unverified", pollMatch, accountMatch, to, pollAddress };
}
