/**
 * Map a Privy (or Privy-shaped) transaction record to our vendor view.
 *
 * Client SDKs wait for confirmation before returning a hash. The backend API
 * returns `transaction_id` + `user_operation_hash` at broadcast, with
 * `transaction_hash` arriving later. A confirmed *bundle* is not automatically
 * a successful user operation — `execution_reverted` is a distinct event.
 *
 * @see https://docs.privy.io/wallets/gas-and-asset-management/gas/transaction-handling
 */

import type { VendorView } from "./verifier";

export interface PrivyTransactionRecord {
  id?: string;
  transaction_id?: string;
  status?: string;
  transaction_hash?: string | null;
  user_operation_hash?: string | null;
  caip2?: string;
}

export interface PrivyWebhookEvent {
  type?: string;
  data?: {
    transaction_id?: string;
    user_operation_hash?: string;
    transaction_hash?: string;
    caip2?: string;
  };
}

const PHASE_BY_STATUS: Record<string, VendorView["phase"]> = {
  pending: "pending",
  broadcasted: "pending",
  confirmed: "confirmed",
  reverted: "reverted",
  execution_reverted: "reverted",
  failed: "failed",
  replaced: "replaced",
  denied: "denied",
};

export function mapPrivyStatus(status: string | null | undefined): VendorView["phase"] {
  if (!status) return "unknown";
  return PHASE_BY_STATUS[status.trim().toLowerCase()] ?? "unknown";
}

export function mapPrivyTransaction(record: PrivyTransactionRecord | null | undefined): VendorView | null {
  if (!record) return null;
  const transactionId = record.id || record.transaction_id;
  if (!transactionId) return null;
  return {
    transactionId,
    phase: mapPrivyStatus(record.status),
    userOperationHash: record.user_operation_hash ?? null,
    transactionHash: record.transaction_hash || null,
  };
}

export function mapPrivyWebhook(event: PrivyWebhookEvent | null | undefined): VendorView | null {
  if (!event?.data?.transaction_id) return null;
  const type = (event.type ?? "").replace(/^transaction\./, "");
  return {
    transactionId: event.data.transaction_id,
    phase: mapPrivyStatus(type),
    userOperationHash: event.data.user_operation_hash ?? null,
    transactionHash: event.data.transaction_hash || null,
  };
}

/** HTTP errors that mean sponsorship was refused, not "try paying ETH instead". */
export function isSponsorshipDeniedStatus(httpStatus: number): boolean {
  return httpStatus === 400 || httpStatus === 402 || httpStatus === 403;
}
