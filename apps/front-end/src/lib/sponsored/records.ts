// Durable sponsored-submission records. These are INTENT + identifiers, not
// confirmation. Unlike P1 VoteReceipt, the outer transaction hash may be
// missing at save time — we key recovery on transaction_id / user_operation_hash.

import type { ReceiptContext, ReceiptStorage } from "../receipts";

const KEY_PREFIX = "venekovox_sponsored:v1";
const TX_ID_RE = /^[\w.:-]{1,128}$/;
const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export interface SponsoredRecord {
  transactionId: string;
  submittedAt: number;
  userOperationHash?: string;
  transactionHash?: string;
}

export type SponsoredParse =
  | { ok: true; record: SponsoredRecord }
  | { ok: false; reason: "invalid-json" | "invalid-transaction-id" | "invalid-hash" | "invalid-time" };

export function sponsoredKey(context: ReceiptContext): string {
  return [
    KEY_PREFIX,
    context.chainId.toString(),
    context.maciAddress.toLowerCase(),
    context.pollId.toString(),
    context.account.toLowerCase(),
  ].join(":");
}

export function parseSponsoredRecord(raw: string): SponsoredParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "invalid-json" };
  }
  const { transactionId, submittedAt, userOperationHash, transactionHash } = parsed as Record<string, unknown>;
  if (typeof transactionId !== "string" || !TX_ID_RE.test(transactionId)) {
    return { ok: false, reason: "invalid-transaction-id" };
  }
  if (typeof submittedAt !== "number" || !Number.isFinite(submittedAt) || submittedAt <= 0) {
    return { ok: false, reason: "invalid-time" };
  }
  if (userOperationHash !== undefined && (typeof userOperationHash !== "string" || !TX_HASH_RE.test(userOperationHash))) {
    return { ok: false, reason: "invalid-hash" };
  }
  if (transactionHash !== undefined && (typeof transactionHash !== "string" || !TX_HASH_RE.test(transactionHash))) {
    return { ok: false, reason: "invalid-hash" };
  }
  const record: SponsoredRecord = { transactionId, submittedAt };
  if (typeof userOperationHash === "string") record.userOperationHash = userOperationHash;
  if (typeof transactionHash === "string") record.transactionHash = transactionHash;
  return { ok: true, record };
}

export function createSponsoredStore(storage: ReceiptStorage = globalThis.localStorage) {
  return {
    save(context: ReceiptContext, record: SponsoredRecord): void {
      if (!storage) throw new Error("Sponsored submission storage is unavailable.");
      const parsed = parseSponsoredRecord(JSON.stringify(record));
      if (!parsed.ok) throw new Error(`Cannot store sponsored record: ${parsed.reason}`);
      storage.setItem(sponsoredKey(context), JSON.stringify(parsed.record));
    },
    load(context: ReceiptContext): SponsoredRecord | null {
      if (!storage) return null;
      const raw = storage.getItem(sponsoredKey(context));
      if (!raw) return null;
      const parsed = parseSponsoredRecord(raw);
      return parsed.ok ? parsed.record : null;
    },
  };
}
