/**
 * Typed eligibility record stored in the browser.
 *
 * sessionStorage only — refresh in the same tab keeps it; a new tab starts
 * over. This is NOT durable recovery (G01). Never put proofs or queryResult
 * in here. The join flow reads `evidence` and sends it as joinPoll.sgDataArg.
 */

export const ELIGIBILITY_STORAGE_KEY = "venekovox_eligibility";

export interface EligibilityRecord {
  venue: "zkpassport";
  account: string;
  evidence: string;
  signature: string;
  issuedAt: number;
  expiresAt: number;
}

export function isEligibilityRecord(value: unknown): value is EligibilityRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as EligibilityRecord;
  return (
    row.venue === "zkpassport" &&
    typeof row.account === "string" &&
    typeof row.evidence === "string" &&
    row.evidence.startsWith("0x") &&
    typeof row.signature === "string" &&
    Number.isFinite(row.issuedAt) &&
    Number.isFinite(row.expiresAt)
  );
}

export function saveEligibility(record: EligibilityRecord, storage: Storage = sessionStorage): void {
  if (JSON.stringify(record).includes("proofs") || JSON.stringify(record).includes("queryResult")) {
    throw new Error("ELIGIBILITY_MUST_NOT_STORE_PROOFS");
  }
  storage.setItem(ELIGIBILITY_STORAGE_KEY, JSON.stringify(record));
}

export function loadEligibility(storage: Storage = sessionStorage): EligibilityRecord | null {
  try {
    const raw = storage.getItem(ELIGIBILITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isEligibilityRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadEligibilityForAccount(
  account: string,
  now = Math.floor(Date.now() / 1000),
  storage: Storage = sessionStorage,
): EligibilityRecord {
  const record = loadEligibility(storage);
  if (!record) throw new Error("Verify eligibility before joining this poll.");
  if (record.account.toLowerCase() !== account.toLowerCase()) {
    throw new Error("Eligibility was issued for a different account. Verify again.");
  }
  if (record.expiresAt <= now) throw new Error("Eligibility expired. Verify again.");
  return record;
}

export function clearEligibility(storage: Storage = sessionStorage): void {
  storage.removeItem(ELIGIBILITY_STORAGE_KEY);
}
