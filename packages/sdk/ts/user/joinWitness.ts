import type { TCircuitInputs } from "../utils/types";
import type { MACI } from "@maci-protocol/contracts/typechain-types";
import type { PrivateKey, PublicKey } from "@maci-protocol/domainobjs";
import type { LeanIMTMerkleProof } from "@zk-kit/lean-imt";
import type { Provider, Signer } from "ethers";

import { assertInclusionProof } from "../trees/inclusionProof";

import { joiningCircuitInputs, preparePollJoiningFromEvents, preparePollJoiningFromSubgraph } from "./utils";

export type JoinWitnessSource = "service" | "subgraph" | "rpc";

export interface ResolvedJoinWitness {
  circuitInputs: TCircuitInputs;
  stateRootIndex: number;
  source: JoinWitnessSource;
}

type SubgraphPrep = typeof preparePollJoiningFromSubgraph;
type EventsPrep = typeof preparePollJoiningFromEvents;

/**
 * Validate a proof against the pinned on-chain root, then build circuit inputs.
 * joiningCircuitInputs must not mutate `proof` (paddedSiblings copies the array).
 */
export const validateAndBuildJoinInputs = async ({
  maciContract,
  proof,
  stateRootIndex,
  expectedLeaf,
  stateTreeDepth,
  userMaciPrivateKey,
  userMaciPublicKey,
  pollId,
}: {
  maciContract: Pick<MACI, "getStateRootOnIndexedSignUp">;
  proof: LeanIMTMerkleProof;
  stateRootIndex: number;
  expectedLeaf: bigint;
  stateTreeDepth: bigint;
  userMaciPrivateKey: PrivateKey;
  userMaciPublicKey: PublicKey;
  pollId: bigint;
}): Promise<TCircuitInputs> => {
  const expectedRoot = await maciContract.getStateRootOnIndexedSignUp(stateRootIndex);
  assertInclusionProof({
    proof,
    expectedLeaf,
    expectedRoot: BigInt(expectedRoot.toString()),
  });
  return joiningCircuitInputs(proof, stateTreeDepth, userMaciPrivateKey, userMaciPublicKey, pollId);
};

/**
 * Try service proof, then subgraph, then RPC. Each source prepares and validates
 * inside its own boundary so a bad service proof can still join via fallback.
 * Does not submit a transaction.
 */
export const resolvePinnedJoinInputs = async ({
  maciContract,
  maciAddress,
  userMaciPublicKey,
  userMaciPrivateKey,
  pollId,
  stateTreeDepth,
  stateIndex,
  inclusionProof,
  pinnedStateRootIndex,
  subgraphUrl,
  signer,
  startBlock,
  endBlock,
  blocksPerBatch,
  provider,
  prepareFromSubgraph = preparePollJoiningFromSubgraph,
  prepareFromEvents = preparePollJoiningFromEvents,
}: {
  maciContract: MACI;
  maciAddress: string;
  userMaciPublicKey: PublicKey;
  userMaciPrivateKey: PrivateKey;
  pollId: bigint;
  stateTreeDepth: bigint;
  stateIndex: bigint;
  inclusionProof?: LeanIMTMerkleProof;
  pinnedStateRootIndex?: number | bigint | null;
  subgraphUrl?: string;
  signer: Signer;
  startBlock?: number;
  endBlock?: number;
  blocksPerBatch?: number;
  provider?: Provider;
  prepareFromSubgraph?: SubgraphPrep;
  prepareFromEvents?: EventsPrep;
}): Promise<ResolvedJoinWitness> => {
  const expectedLeaf = userMaciPublicKey.hash();

  if (inclusionProof) {
    try {
      if (pinnedStateRootIndex === undefined || pinnedStateRootIndex === null) {
        throw new Error("stateRootIndex is required when inclusionProof is provided.");
      }
      const stateRootIndex = Number(pinnedStateRootIndex);
      const circuitInputs = await validateAndBuildJoinInputs({
        maciContract,
        proof: inclusionProof,
        stateRootIndex,
        expectedLeaf,
        stateTreeDepth,
        userMaciPrivateKey,
        userMaciPublicKey,
        pollId,
      });
      return { circuitInputs, stateRootIndex, source: "service" };
    } catch {
      // Invalid or incomplete service proof — try subgraph, then RPC.
    }
  }

  if (subgraphUrl) {
    try {
      const prepared = await prepareFromSubgraph({
        subgraphUrl,
        maciAddress,
        maciContract,
        stateIndex,
        pollId,
        userMaciPrivateKey,
      });
      await validateAndBuildJoinInputs({
        maciContract,
        proof: prepared.inclusionProof,
        stateRootIndex: prepared.stateRootIndex,
        expectedLeaf,
        stateTreeDepth,
        userMaciPrivateKey,
        userMaciPublicKey,
        pollId,
      });
      return {
        circuitInputs: prepared.inputs,
        stateRootIndex: prepared.stateRootIndex,
        source: "subgraph",
      };
    } catch {
      // Subgraph prepare or root check failed — last fallback is RPC.
    }
  }

  const prepared = await prepareFromEvents({
    maciContract,
    stateIndex,
    pollId,
    userMaciPrivateKey,
    signer,
    startBlock,
    endBlock,
    blocksPerBatch,
    provider,
  });
  await validateAndBuildJoinInputs({
    maciContract,
    proof: prepared.inclusionProof,
    stateRootIndex: prepared.stateRootIndex,
    expectedLeaf,
    stateTreeDepth,
    userMaciPrivateKey,
    userMaciPublicKey,
    pollId,
  });
  return {
    circuitInputs: prepared.inputs,
    stateRootIndex: prepared.stateRootIndex,
    source: "rpc",
  };
};
