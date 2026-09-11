import { hashLeanIMT, hashLeftRight, PAD_KEY_HASH } from "@maci-protocol/crypto";
import { LeanIMT, type LeanIMTMerkleProof } from "@zk-kit/lean-imt";

import type { LeafRow } from "./snapshot";

/** Insert this many new hashes before yielding so proof GETs can run. */
export const APPEND_YIELD_EVERY = 64;

function leafHashes(leaves: LeafRow[]): bigint[] {
  return leaves.map((leaf) => hashLeftRight(BigInt(leaf.publicKeyX), BigInt(leaf.publicKeyY)));
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

/**
 * Cold/full rebuild: PAD at index 0, then every SignUp leaf in order.
 * Use for first load and reorgs. Incremental appends must not call this.
 */
export function buildSignUpTree(leaves: LeafRow[]): LeanIMT {
  const tree = new LeanIMT(hashLeanIMT);
  tree.insert(PAD_KEY_HASH);
  for (const leaf of leaves) {
    tree.insert(hashLeftRight(BigInt(leaf.publicKeyX), BigInt(leaf.publicKeyY)));
  }
  return tree;
}

/**
 * Clone `tree` via export/import (no hash recompute), then insert only `extra`.
 * The original tree is left unchanged so the published snapshot stays readable
 * until the caller checks the new root and swaps cache.
 */
export async function appendSignupLeaves(
  tree: LeanIMT,
  extra: LeafRow[],
  yieldEvery = APPEND_YIELD_EVERY,
): Promise<LeanIMT> {
  const next = LeanIMT.import(hashLeanIMT, tree.export());
  if (extra.length === 0) return next;
  const hashes = leafHashes(extra);
  const chunk = Math.max(1, yieldEvery);
  for (let offset = 0; offset < hashes.length; offset += chunk) {
    if (offset > 0) await yieldToEventLoop();
    next.insertMany(hashes.slice(offset, offset + chunk));
  }
  return next;
}

export function generateSignupInclusionProof(tree: LeanIMT, leafIndex: number): LeanIMTMerkleProof {
  return tree.generateProof(leafIndex);
}

export function snapshotStateRootIndex(tree: LeanIMT): number {
  return tree.size - 1;
}
