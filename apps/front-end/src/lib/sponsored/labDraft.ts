// Lab-only durable draft for E4 refresh recovery.
// Intent identifiers only — never confirmation. Separate from production vote receipts.

import type { ReceiptStorage } from "../receipts";
import { TX_HASH_RE } from "./verifier";

const KEY = "venekovox_w1_lab_draft:v1";
const TX_ID_RE = /^[\w.:-]{1,128}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/i;

export interface LabDraft {
  transactionId: string;
  submittedAt: number;
  chainId: string;
  participant?: string;
  pollAddress?: string;
  userOperationHash?: string;
  transactionHash?: string;
  /** probe | alwaysRevert | custom — what the lab last asked to send */
  intent?: string;
}

export type LabDraftParse =
  | { ok: true; draft: LabDraft }
  | { ok: false; reason: string };

export function parseLabDraft(raw: string): LabDraftParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "invalid-json" };
  const row = parsed as Record<string, unknown>;
  if (typeof row.transactionId !== "string" || !TX_ID_RE.test(row.transactionId)) {
    return { ok: false, reason: "invalid-transaction-id" };
  }
  if (typeof row.submittedAt !== "number" || !Number.isFinite(row.submittedAt) || row.submittedAt <= 0) {
    return { ok: false, reason: "invalid-time" };
  }
  if (typeof row.chainId !== "string" || !/^\d+$/.test(row.chainId)) {
    return { ok: false, reason: "invalid-chain" };
  }
  if (row.participant !== undefined && (typeof row.participant !== "string" || !ADDRESS_RE.test(row.participant))) {
    return { ok: false, reason: "invalid-participant" };
  }
  if (row.pollAddress !== undefined && (typeof row.pollAddress !== "string" || !ADDRESS_RE.test(row.pollAddress))) {
    return { ok: false, reason: "invalid-poll" };
  }
  if (
    row.userOperationHash !== undefined &&
    (typeof row.userOperationHash !== "string" || !TX_HASH_RE.test(row.userOperationHash))
  ) {
    return { ok: false, reason: "invalid-hash" };
  }
  if (
    row.transactionHash !== undefined &&
    (typeof row.transactionHash !== "string" || !TX_HASH_RE.test(row.transactionHash))
  ) {
    return { ok: false, reason: "invalid-hash" };
  }
  const draft: LabDraft = {
    transactionId: row.transactionId,
    submittedAt: row.submittedAt,
    chainId: row.chainId,
  };
  if (typeof row.participant === "string") draft.participant = row.participant;
  if (typeof row.pollAddress === "string") draft.pollAddress = row.pollAddress;
  if (typeof row.userOperationHash === "string") draft.userOperationHash = row.userOperationHash;
  if (typeof row.transactionHash === "string") draft.transactionHash = row.transactionHash;
  if (typeof row.intent === "string") draft.intent = row.intent;
  return { ok: true, draft };
}

export function loadLabDraft(storage: Pick<Storage, "getItem"> | null = globalThis.localStorage): LabDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = parseLabDraft(raw);
    return parsed.ok ? parsed.draft : null;
  } catch {
    return null;
  }
}

export function saveLabDraft(
  draft: LabDraft,
  storage: Pick<Storage, "setItem"> | null = globalThis.localStorage,
): void {
  if (!storage) throw new Error("Lab draft storage is unavailable.");
  const parsed = parseLabDraft(JSON.stringify(draft));
  if (!parsed.ok) throw new Error(`Cannot store lab draft: ${parsed.reason}`);
  storage.setItem(KEY, JSON.stringify(parsed.draft));
}

/** Merge new fields without resetting submittedAt when the same transaction_id is updated. */
export function upsertLabDraft(
  next: Omit<LabDraft, "submittedAt"> & { submittedAt?: number },
  storage: ReceiptStorage | null = globalThis.localStorage,
): LabDraft {
  const existing = loadLabDraft(storage);
  const submittedAt =
    existing && existing.transactionId === next.transactionId
      ? existing.submittedAt
      : next.submittedAt && next.submittedAt > 0
        ? next.submittedAt
        : Date.now();
  const draft: LabDraft = {
    ...existing,
    ...next,
    submittedAt,
  };
  saveLabDraft(draft, storage);
  return draft;
}
