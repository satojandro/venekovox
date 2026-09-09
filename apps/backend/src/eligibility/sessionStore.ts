/**
 * SessionStore — G01 durability seam for the product eligibility mount.
 *
 * ZkPassportEligibility and EligibilityService already keep short-lived
 * challenges in an in-memory Map (300s expiry, capacity 500, busy lock).
 * This interface is the explicit place a future Redis/SQLite backend would
 * plug in. The default MemorySessionStore is NOT durable and MUST NOT be
 * described as transactional or crash-safe.
 *
 * Release gate G01 remains open until a durable/transactional store exists.
 * Do not put proofs, query results or uniqueIdentifier values in this store.
 */

export interface EligibilitySessionRecord {
  challengeId: string;
  account: string;
  expiresAt: number;
}

export interface SessionStore {
  get(id: string): EligibilitySessionRecord | undefined;
  set(record: EligibilitySessionRecord): void;
  delete(id: string): void;
  /** Drop expired rows. Capacity is enforced by EligibilityService (500). */
  prune(now: number): void;
  size(): number;
}

const DEFAULT_CAPACITY = 500;

export class MemorySessionStore implements SessionStore {
  private readonly rows = new Map<string, EligibilitySessionRecord>();
  constructor(private readonly capacity = DEFAULT_CAPACITY) {}

  get(id: string): EligibilitySessionRecord | undefined {
    return this.rows.get(id);
  }

  set(record: EligibilitySessionRecord): void {
    if (this.rows.size >= this.capacity && !this.rows.has(record.challengeId)) {
      throw new Error("CHALLENGE_CAPACITY");
    }
    this.rows.set(record.challengeId, { ...record });
  }

  delete(id: string): void {
    this.rows.delete(id);
  }

  prune(now: number): void {
    for (const [id, row] of this.rows) {
      if (row.expiresAt <= now) this.rows.delete(id);
    }
  }

  size(): number {
    return this.rows.size;
  }
}
