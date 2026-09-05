// Vote receipt persistence.
//
// A receipt records that an encrypted vote message was SUBMITTED on-chain. It is
// NOT proof the vote was counted — counting happens at tally time (P4). We store
// only the transaction hash and submission time: never the selected option, and
// never a "counted" claim.
//
// Storage is injectable so the upcoming embedded-wallet / smart-account
// integration can replace localStorage without touching the vote flow.

export interface VoteReceipt {
  txHash: string;
  submittedAt: number; // epoch milliseconds
}

// A mined transaction hash on an EVM chain is exactly 32 bytes of hex,
// lower- or upper-cased, with a 0x prefix. Anything else is not a receipt
// we can ever verify against a chain (G11).
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export function isValidTxHash(value: string): boolean {
  return TX_HASH_RE.test(value);
}

export type StoredReceiptParse =
  | { ok: true; receipt: VoteReceipt }
  | { ok: false; reason: "invalid-json" | "invalid-tx-hash" | "invalid-time" };

/**
 * Strict parse of a raw localStorage record. Missing or malformed storage is
 * "unable to confirm", never success. The label lets callers tell a corrupt
 * record apart from one with an unverifiable transaction hash.
 */
export function parseStoredReceipt(raw: string): StoredReceiptParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "invalid-json" };
  }
  const { txHash, submittedAt } = parsed as Record<string, unknown>;
  if (typeof txHash !== "string" || !isValidTxHash(txHash)) {
    return { ok: false, reason: "invalid-tx-hash" };
  }
  if (typeof submittedAt !== "number" || !Number.isFinite(submittedAt) || submittedAt <= 0) {
    return { ok: false, reason: "invalid-time" };
  }
  return { ok: true, receipt: { txHash, submittedAt } };
}

export interface ReceiptContext {
  chainId: bigint;
  maciAddress: string;
  pollId: bigint;
  account: string;
}

export interface ReceiptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY_PREFIX = "venekovox_receipt:v1";

export function receiptKey(context: ReceiptContext): string {
  // The context IS the key: a receipt can only ever be loaded for the exact
  // chain / contract / poll / wallet it was created under. Components are
  // lowercased so checksum differences cannot fork the namespace.
  return [
    KEY_PREFIX,
    context.chainId.toString(),
    context.maciAddress.toLowerCase(),
    context.pollId.toString(),
    context.account.toLowerCase(),
  ].join(":");
}

export function applySubmittedReceipt(persist: () => void, displayAndVerify: () => void): void {
  try {
    persist();
  } catch {
    // Persistence is best-effort. A submitted vote must still be shown and verified.
  }
  displayAndVerify();
}

export function createReceiptStore(storage: ReceiptStorage = globalThis.localStorage) {
  return {
    save(context: ReceiptContext, receipt: VoteReceipt): void {
      if (!storage) throw new Error("Receipt storage is unavailable.");
      storage.setItem(receiptKey(context), JSON.stringify(receipt));
    },
    load(context: ReceiptContext): VoteReceipt | null {
      // Missing, malformed or corrupt storage always means "unable to confirm",
      // never "confirmed".
      if (!storage) return null;
      const raw = storage.getItem(receiptKey(context));
      if (!raw) return null;
      const parsed = parseStoredReceipt(raw);
      return parsed.ok ? parsed.receipt : null;
    },
  };
}
