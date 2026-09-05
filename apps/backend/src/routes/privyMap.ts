/**
 * Keep in sync with apps/front-end/src/lib/sponsored/vendorStatus.ts
 * (the backend cannot import the Vite app).
 */

export interface VendorView {
  transactionId: string;
  phase: "pending" | "confirmed" | "reverted" | "failed" | "replaced" | "denied" | "unknown";
  userOperationHash?: string | null;
  transactionHash?: string | null;
}

export interface PrivyTransactionRecord {
  id?: string;
  transaction_id?: string;
  status?: string;
  transaction_hash?: string | null;
  user_operation_hash?: string | null;
}

export interface PrivyWebhookEvent {
  type?: string;
  data?: {
    transaction_id?: string;
    user_operation_hash?: string;
    transaction_hash?: string;
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

/** Explicit sponsorship refusal on a *send* path — not a status-lookup failure. */
export function isSponsorshipDeniedSendStatus(httpStatus: number): boolean {
  return httpStatus === 402 || httpStatus === 403;
}
