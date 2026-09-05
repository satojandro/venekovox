// On-chain verification of a stored submission receipt.
//
// A stored record is evidence of INTENT, not confirmation. Only the chain can
// say whether the transaction was mined, whether it succeeded, and whether it
// targeted this poll's MACI contract. Even a confirmed submission is still NOT
// a counted vote — counting is the tally's domain (P4) and this module never
// claims it.
//
// The provider interface is deliberately minimal so the decision logic can be
// unit-tested without a network or a React harness.

// Shared with receipts.ts; kept local so this module has no relative imports
// (the unit-test harness executes modules as data: URLs).
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function isValidTxHash(value: string): boolean {
  return TX_HASH_RE.test(value);
}

export type ReceiptCheckStatus =
  | "unverified" // no check performed or possible yet (e.g. just submitted)
  | "pending" // transaction not found yet — may be unmined, or unavailable
  | "confirmed" // mined, succeeded, and targeted the configured MACI contract
  | "unexpected" // mined and succeeded, but the recipient is not the configured MACI contract
  | "reverted" // mined and failed
  | "unavailable"; // the chain did not answer — we do NOT know (never "failed")

export interface ReceiptCheckResult {
  status: ReceiptCheckStatus;
  /** true when the receipt's recipient matches the configured MACI contract. */
  maciMatch: boolean;
  /** Recipient address as reported by the chain, if any. */
  to?: string | null;
}

export interface ReceiptProvider {
  getTransactionReceipt(hash: string): Promise<{ status?: number | null; to?: string | null } | null>;
}

export async function checkReceiptStatus(args: {
  provider: ReceiptProvider;
  txHash: string;
  maciAddress: string;
}): Promise<ReceiptCheckResult> {
  const { provider, txHash, maciAddress } = args;
  if (!isValidTxHash(txHash)) {
    return { status: "unverified", maciMatch: false };
  }

  let receipt: { status?: number | null; to?: string | null } | null;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch {
    // RPC failure: not knowing must never be presented as a failed vote.
    return { status: "unavailable", maciMatch: false };
  }

  if (!receipt) {
    // Not found means unmined (or still propagating), never "failed".
    return { status: "pending", maciMatch: false };
  }

  const to = receipt.to ? receipt.to.toLowerCase() : null;
  const maciMatch = to === maciAddress.toLowerCase();

  if (receipt.status === 0) {
    return { status: "reverted", maciMatch, to };
  }
  if (receipt.status === 1) {
    return maciMatch ? { status: "confirmed", maciMatch: true, to } : { status: "unexpected", maciMatch: false, to };
  }
  // Status absent (pre-EIP-658 receipts) carries no success signal: stay pending
  // rather than guessing.
  return { status: "pending", maciMatch, to };
}
