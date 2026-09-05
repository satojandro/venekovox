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
      try {
        const parsed = JSON.parse(raw) as VoteReceipt;
        if (
          typeof parsed.txHash !== "string" ||
          !parsed.txHash.startsWith("0x") ||
          typeof parsed.submittedAt !== "number"
        ) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    },
  };
}
