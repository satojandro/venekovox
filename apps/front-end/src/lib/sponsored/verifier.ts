// Sponsored-execution verifier (W1). This is NOT the P1 direct-EOA verifier.
// P1 requires transaction.from = participant, transaction.to = Poll, calldata =
// publishMessage(Batch). Sponsored execution can keep the participating address
// as msg.sender and still fail those checks. Do not "fix" that by returning to
// generic log-topic matching.

export const PUBLISH_MESSAGE_TOPIC =
  "0x4be9ef9ae736055964ead1cf3c83a19c8b662b5df2bd4414776bb64d81f75d15";

/** keccak256("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)") */
export const USER_OPERATION_EVENT_TOPIC =
  "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";

export const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

function isAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && ADDRESS_RE.test(value);
}

function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && isAddress(a) && isAddress(b) && a.toLowerCase() === b.toLowerCase();
}

export type SponsoredOutcome =
  | "pending" // broadcast, not yet able to confirm or deny
  | "confirmed" // user-op succeeded AND inner Poll publication from the participant
  | "reverted" // the intended call failed (even if the outer bundle mined)
  | "failed" // vendor could not include the operation
  | "denied" // sponsorship refused; must not silently become a user-paid tx
  | "outcome-unknown" // timeout after broadcast; do not claim nothing happened
  | "unavailable" // lookup failed; we do not know
  | "unverified"; // not enough evidence, or only an outer bundle receipt

export interface VendorView {
  transactionId: string;
  /**
   * Vendor's claim about the *user operation*, not the outer bundle.
   * `confirmed` here means Privy (or equivalent) reported the user-op succeeded.
   */
  phase: "pending" | "confirmed" | "reverted" | "failed" | "replaced" | "denied" | "unknown";
  userOperationHash?: string | null;
  transactionHash?: string | null;
}

export interface ReceiptLog {
  address?: string | null;
  topics?: readonly string[] | null;
  /** Non-indexed event data (needed for UserOperationEvent.success). */
  data?: string | null;
}

export interface OuterReceipt {
  status?: number | null;
  to?: string | null;
  from?: string | null;
  logs?: readonly ReceiptLog[] | null;
}

export interface InnerPublicationEvidence {
  pollAddress: string;
  hasPublishMessage: boolean;
  /** Who the Poll (or probe) observed as msg.sender, if we have that evidence. */
  observedCaller?: string | null;
}

export interface UserOperationEvidence {
  userOperationHash: string;
  sender: string;
  success: boolean;
}

export interface SponsoredCheckResult {
  status: SponsoredOutcome;
  pollMatch: boolean;
  /** True only when the *inner* caller matches the participating account. */
  accountMatch: boolean;
  /** Outer receipt `from`, if we looked it up. Never used as the participant. */
  outerFrom?: string | null;
  outerTo?: string | null;
}

export interface SponsoredLookup {
  vendor: VendorView | null;
  vendorLookup: "ok" | "missing" | "error" | "timeout";
  outerReceipt: OuterReceipt | null;
  outerReceiptLookup: "ok" | "null" | "error";
  inner: InnerPublicationEvidence | null;
}

function topicAddress(topic: string | undefined): string | null {
  if (!topic || !/^0x[0-9a-fA-F]{64}$/.test(topic)) return null;
  const addr = "0x" + topic.slice(26);
  return ADDRESS_RE.test(addr) ? addr : null;
}

function readSuccessFlag(data: string | null | undefined): boolean | null {
  if (!data) return null;
  const hex = data.startsWith("0x") || data.startsWith("0X") ? data.slice(2) : data;
  // UserOperationEvent data: nonce, success, actualGasCost, actualGasUsed (four words).
  const word = hex.slice(64, 128);
  if (word.length !== 64 || !/^[0-9a-fA-F]+$/.test(word)) return null;
  return BigInt("0x" + word) !== 0n;
}

/**
 * Find the ERC-4337 UserOperationEvent for *this* user-op hash.
 * A bundle can contain many user ops — never guess when the hash is missing.
 */
export function findUserOperation(
  receipt: OuterReceipt,
  userOperationHash?: string | null,
): UserOperationEvidence | null {
  if (!userOperationHash || !TX_HASH_RE.test(userOperationHash)) return null;
  const want = userOperationHash.toLowerCase();
  const topic = USER_OPERATION_EVENT_TOPIC.toLowerCase();
  for (const log of receipt.logs ?? []) {
    const topics = log.topics ?? [];
    if (!topics[0] || topics[0].toLowerCase() !== topic) continue;
    const hash = topics[1];
    const sender = topicAddress(topics[2]);
    if (!hash || hash.toLowerCase() !== want || !sender) continue;
    const success = readSuccessFlag(log.data);
    if (success === null) continue;
    return { userOperationHash: hash, sender, success };
  }
  return null;
}

export function hasPublishMessageFrom(receipt: OuterReceipt, pollAddress: string): boolean {
  if (!isAddress(pollAddress)) return false;
  const poll = pollAddress.toLowerCase();
  const topic = PUBLISH_MESSAGE_TOPIC.toLowerCase();
  for (const log of receipt.logs ?? []) {
    if (!log.address || !isAddress(log.address) || log.address.toLowerCase() !== poll) continue;
    const first = log.topics?.[0];
    if (typeof first === "string" && first.toLowerCase() === topic) return true;
  }
  return false;
}

/**
 * Confirm a sponsored Poll publication.
 *
 * A mined outer transaction is not confirmation: the bundle can succeed while
 * the user operation reverts. Confirm only when UserOperationEvent.success is
 * true for *this* user-op hash, the resolved Poll emitted PublishMessage, and
 * the inner caller (event sender or observed msg.sender) is the participant.
 */
export function checkSponsoredPublication(args: {
  participant: string;
  pollAddress: string;
  lookup: SponsoredLookup;
}): SponsoredCheckResult {
  const { participant, pollAddress, lookup } = args;
  const outerFrom = lookup.outerReceipt?.from ?? null;
  const outerTo = lookup.outerReceipt?.to ?? null;
  const userOp = lookup.outerReceipt
    ? findUserOperation(lookup.outerReceipt, lookup.vendor?.userOperationHash)
    : null;
  const innerCaller = lookup.inner?.observedCaller ?? userOp?.sender ?? null;
  const pollMatch = !!(lookup.inner?.hasPublishMessage && sameAddress(lookup.inner.pollAddress, pollAddress));
  const accountMatch = sameAddress(innerCaller, participant);

  if (lookup.vendorLookup === "error") {
    return { status: "unavailable", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (lookup.vendorLookup === "timeout") {
    return { status: "outcome-unknown", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (lookup.vendorLookup === "missing" || !lookup.vendor) {
    return { status: "unverified", pollMatch, accountMatch, outerFrom, outerTo };
  }

  const phase = lookup.vendor.phase;
  if (phase === "denied") {
    return { status: "denied", pollMatch: false, accountMatch: false, outerFrom, outerTo };
  }
  if (phase === "failed") {
    return { status: "failed", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (phase === "reverted") {
    return { status: "reverted", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (phase === "replaced") {
    return { status: "outcome-unknown", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (phase === "unknown") {
    return { status: "unverified", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (phase === "pending") {
    return { status: "pending", pollMatch, accountMatch, outerFrom, outerTo };
  }

  // Vendor claims the user-op succeeded. An outer receipt of status 1 is still
  // not confirmation of a Poll publication — and a missing RPC receipt is lag,
  // not vendor failure.
  if (lookup.outerReceiptLookup === "error") {
    return { status: "unavailable", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (lookup.outerReceiptLookup === "null" || !lookup.outerReceipt) {
    return { status: "pending", pollMatch, accountMatch, outerFrom, outerTo };
  }

  if (lookup.outerReceipt.status === 0) {
    return { status: "reverted", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (lookup.outerReceipt.status !== 1) {
    return { status: "pending", pollMatch, accountMatch, outerFrom, outerTo };
  }

  // A mined bundle can still contain a failed user operation.
  if (userOp && userOp.success === false) {
    return { status: "reverted", pollMatch, accountMatch, outerFrom, outerTo };
  }
  // Without a matching UserOperationEvent we cannot treat vendor "confirmed"
  // as proof this specific operation succeeded (7702-only paths stay unverified
  // until E2 shows a different inner-success signal).
  if (!userOp || userOp.success !== true) {
    return { status: "unverified", pollMatch, accountMatch, outerFrom, outerTo };
  }

  if (!lookup.inner) {
    return { status: "unverified", pollMatch: false, accountMatch: false, outerFrom, outerTo };
  }
  if (!sameAddress(lookup.inner.pollAddress, pollAddress) || !lookup.inner.hasPublishMessage) {
    return { status: "unverified", pollMatch, accountMatch, outerFrom, outerTo };
  }
  if (!accountMatch) {
    return { status: "unverified", pollMatch: true, accountMatch: false, outerFrom, outerTo };
  }

  return { status: "confirmed", pollMatch: true, accountMatch: true, outerFrom, outerTo };
}

export function innerFromPollLogs(
  receipt: OuterReceipt,
  pollAddress: string,
  observedCaller?: string | null,
): InnerPublicationEvidence {
  return {
    pollAddress,
    hasPublishMessage: hasPublishMessageFrom(receipt, pollAddress),
    observedCaller: observedCaller ?? null,
  };
}

export function isTxHash(value: string | null | undefined): value is string {
  return typeof value === "string" && TX_HASH_RE.test(value);
}
