import { hashLeanIMT } from "@maci-protocol/crypto";
import { LeanIMT, type LeanIMTMerkleProof } from "@zk-kit/lean-imt";

/**
 * Circuit padding must not mutate the LeanIMT proof. verifyProof fails once
 * compressed siblings are extended with zeros in place.
 */
export const paddedSiblings = (proof: LeanIMTMerkleProof, stateTreeDepth: bigint | number): bigint[] => {
  const siblings = proof.siblings.slice();
  const depth = Number(stateTreeDepth);
  for (let i = siblings.length; i < depth; i += 1) {
    siblings.push(0n);
  }
  return siblings;
};

/**
 * Confirm a LeanIMT proof belongs to expectedLeaf and a pinned on-chain root.
 * Proof.index may be compressed and must not be compared to the signup leafIndex.
 */
export const assertInclusionProof = ({
  proof,
  expectedLeaf,
  expectedRoot,
}: {
  proof: LeanIMTMerkleProof;
  expectedLeaf: bigint;
  expectedRoot: bigint;
}): void => {
  if (proof.leaf !== expectedLeaf) {
    throw new Error("Inclusion proof leaf does not match this device's MACI public key.");
  }
  if (proof.root !== expectedRoot) {
    throw new Error("Inclusion proof root does not match the pinned on-chain state root.");
  }
  const tree = new LeanIMT(hashLeanIMT);
  if (!tree.verifyProof(proof)) {
    throw new Error("Inclusion proof failed LeanIMT verification.");
  }
};

export const parseJsonInclusionProof = (value: {
  root: string;
  leaf: string;
  index: number;
  siblings: string[];
}): LeanIMTMerkleProof => ({
  root: BigInt(value.root),
  leaf: BigInt(value.leaf),
  index: value.index,
  siblings: value.siblings.map((sibling) => BigInt(sibling)),
});

export const serializeInclusionProof = (
  proof: LeanIMTMerkleProof,
): {
  root: string;
  leaf: string;
  index: number;
  siblings: string[];
} => ({
  root: proof.root.toString(),
  leaf: proof.leaf.toString(),
  index: proof.index,
  siblings: proof.siblings.map((sibling) => sibling.toString()),
});
