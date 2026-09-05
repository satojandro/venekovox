// EIP-7702 sets account code to 0xef0100 || address(20). That delegation stays
// until the account sets different code or clears it — it is not per-transaction.
// ERC-4337 is a different layer (bundlers / EntryPoint). An account can use both.

export const EIP7702_DELEGATION_PREFIX = "0xef0100";

export type AccountCodeKind = "empty-eoa" | "eip-7702-delegated" | "contract";

export interface AccountCodeClassification {
  kind: AccountCodeKind;
  /** Delegation target when kind is eip-7702-delegated (20-byte address). */
  implementation?: string;
}

function normalizeCode(code: string | null | undefined): string {
  if (!code || code === "0x" || code === "0X") return "0x";
  return code.toLowerCase();
}

export function classifyAccountCode(code: string | null | undefined): AccountCodeClassification {
  const hex = normalizeCode(code);
  if (hex === "0x") return { kind: "empty-eoa" };
  if (hex.startsWith(EIP7702_DELEGATION_PREFIX) && hex.length === EIP7702_DELEGATION_PREFIX.length + 40) {
    return { kind: "eip-7702-delegated", implementation: "0x" + hex.slice(EIP7702_DELEGATION_PREFIX.length) };
  }
  return { kind: "contract" };
}
