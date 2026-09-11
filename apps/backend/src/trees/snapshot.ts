/**
 * Snapshot provenance and pagination for MACI StateLeaves.
 * Pure functions so tests do not need Graph or Poseidon.
 */

export class SnapshotError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "SnapshotError";
  }
}

export interface LeafRow {
  stateIndex: string;
  publicKeyX: string;
  publicKeyY: string;
}

export interface Provenance {
  blockNumber: number;
  blockHash: string;
}

export interface SnapshotMeta {
  provenance: Provenance;
  leafFingerprint: string;
}

export function assertNoIndexingError(meta: { hasIndexingErrors?: boolean }): void {
  if (meta.hasIndexingErrors) {
    throw new SnapshotError("Subgraph hasIndexingErrors is true.", "INDEXING_ERROR");
  }
}

export function assertContiguousSignupIndexes(leaves: LeafRow[]): void {
  for (let i = 0; i < leaves.length; i += 1) {
    const expected = BigInt(i + 1);
    if (BigInt(leaves[i].stateIndex) !== expected) {
      throw new SnapshotError(
        `signup index gap at ${i}: expected ${expected}, got ${leaves[i].stateIndex}`,
        "PAGINATION_GAP",
      );
    }
  }
}

export function leafFingerprint(leaves: LeafRow[]): string {
  return leaves.map((leaf) => `${leaf.stateIndex}:${leaf.publicKeyX}:${leaf.publicKeyY}`).join("|");
}

export function provenanceChanged(previous: Provenance, next: Provenance): boolean {
  return previous.blockNumber !== next.blockNumber || previous.blockHash !== next.blockHash;
}

/** Same leaf count can still be a reorg if the key set changed. */
export function sameSizeReorg(
  previous: SnapshotMeta,
  next: SnapshotMeta,
  nextSize: number,
  previousSize: number,
): boolean {
  return previousSize === nextSize && previous.leafFingerprint !== next.leafFingerprint;
}

/** Rebuild when there is no cache, the indexer reported errors, or the pinned block changed (including same-height reorgs). */
export function shouldRebuildCache(
  cache: SnapshotMeta | null,
  head: { blockNumber: number; blockHash: string; hasIndexingErrors?: boolean },
): boolean {
  if (!cache) return true;
  if (head.hasIndexingErrors) return true;
  return provenanceChanged(cache.provenance, { blockNumber: head.blockNumber, blockHash: head.blockHash });
}

export async function collectPages<T extends LeafRow>({
  fetchPage,
  pageSize,
  startCursor = 0n,
  startExpectedIndex = 1n,
}: {
  fetchPage: (cursor: bigint, pageSize: number) => Promise<T[]>;
  pageSize: number;
  startCursor?: bigint;
  startExpectedIndex?: bigint;
}): Promise<T[]> {
  const leaves: T[] = [];
  let cursor = startCursor;
  for (;;) {
    const page = await fetchPage(cursor, pageSize);
    leaves.push(...page);
    if (page.length < pageSize) break;
    cursor = BigInt(page[page.length - 1].stateIndex);
  }
  for (let i = 0; i < leaves.length; i += 1) {
    const expected = startExpectedIndex + BigInt(i);
    if (BigInt(leaves[i].stateIndex) !== expected) {
      throw new SnapshotError(
        `signup index gap at extra ${i}: expected ${expected}, got ${leaves[i].stateIndex}`,
        "PAGINATION_GAP",
      );
    }
  }
  if (startCursor === 0n) {
    assertContiguousSignupIndexes(leaves);
  }
  return leaves;
}

/** True when extra leaves continue immediately after previous (append-only). */
export function canAppendLeaves(previous: LeafRow[], extra: LeafRow[]): boolean {
  if (extra.length === 0) return true;
  const expectedNext = previous.length === 0 ? 1n : BigInt(previous[previous.length - 1].stateIndex) + 1n;
  for (let i = 0; i < extra.length; i += 1) {
    if (BigInt(extra[i].stateIndex) !== expectedNext + BigInt(i)) return false;
  }
  return true;
}

export function lastLeafMatches(previous: LeafRow[], observed: LeafRow | undefined): boolean {
  if (previous.length === 0) return true;
  const last = previous[previous.length - 1];
  return (
    !!observed &&
    observed.stateIndex === last.stateIndex &&
    observed.publicKeyX === last.publicKeyX &&
    observed.publicKeyY === last.publicKeyY
  );
}

/** Keep a lagging snapshot only when its root still matches the contract at that index. */
export function historicalRootMatches(treeRoot: bigint, onChainRoot: bigint): boolean {
  return treeRoot === onChainRoot;
}

export function findLeafIndex(leaves: LeafRow[], publicKeyX: string, publicKeyY: string): number {
  const i = leaves.findIndex((leaf) => leaf.publicKeyX === publicKeyX && leaf.publicKeyY === publicKeyY);
  if (i < 0) {
    throw new SnapshotError("Public key is not in this signup snapshot.", "VOTER_NOT_IN_SNAPSHOT");
  }
  return Number(leaves[i].stateIndex);
}
