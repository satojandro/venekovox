/* eslint-disable no-underscore-dangle, no-await-in-loop */
import { MACI__factory as MACIFactory, Poll__factory as PollFactory } from "@maci-protocol/contracts/typechain-types";
import { poseidon } from "@maci-protocol/crypto";
import { Keypair, PrivateKey } from "@maci-protocol/domainobjs";
import { Wallet } from "ethers";

import type { IJoinPollBrowserArgs, IJoinPollData } from "../user/types";

import { resolvePinnedJoinInputs } from "../user/joinWitness";
import { hasUserJoinedPoll } from "../user/utils";
import { contractExists } from "../utils/contracts";

import { generateProofSnarkjs, formatProofForVerifierContract } from "./utils";

/** Retry transient RPC failures during read/proof preparation only. */
async function withReadRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const transient =
        message.includes("CALL_EXCEPTION") ||
        message.includes("Rate Limit") ||
        message.includes("-32005") ||
        message.includes("-32602") ||
        message.includes("429") ||
        message.includes("missing revert data");
      if (!transient || attempt === attempts) {
        throw error;
      }
      await new Promise((r) => {
        setTimeout(r, 1500 * 2 ** (attempt - 1));
      });
    }
  }
  throw lastError;
}

/**
 * Join Poll user to the Poll contract
 * @dev This version is optimised to work on browsers
 * @dev It uses WASM + accepts already created inclusion proofs
 * @param {IJoinPollArgs} args - The arguments for the join poll command
 * @returns {IJoinPollData} The poll state index of the joined user and transaction hash
 */
export const joinPoll = async ({
  maciAddress,
  privateKey,
  pollId,
  signer,
  startBlock,
  endBlock,
  blocksPerBatch,
  pollJoiningZkey,
  pollWasm,
  sgDataArg,
  ivcpDataArg,
  inclusionProof,
  stateRootIndex: pinnedStateRootIndex,
  subgraphUrl,
  // Optional read-optimized provider for the state-tree event scan — wallet
  // RPCs rate-limit the large eth_getLogs burst the rebuild triggers.
  provider: readProvider,
}: IJoinPollBrowserArgs): Promise<IJoinPollData> => {
  const validContract = await contractExists(signer.provider!, maciAddress);

  if (!validContract) {
    throw new Error("MACI contract does not exist");
  }

  if (!PrivateKey.isValidSerialized(privateKey)) {
    throw new Error("Invalid MACI private key");
  }

  if (pollId < 0) {
    throw new Error("Invalid poll id");
  }

  const userMaciPrivateKey = PrivateKey.deserialize(privateKey);
  const userMaciPublicKey = new Keypair(userMaciPrivateKey).publicKey;
  const nullifier = poseidon([BigInt(userMaciPrivateKey.asCircuitInputs()), pollId]);

  // check if the user has already joined the poll based on the nullifier.
  // Read-only lookup — keep it off the wallet RPC (same rationale as
  // readSigner below); needs a signer-shaped object for the factory.
  const nullifierReadSigner = readProvider ? Wallet.createRandom().connect(readProvider) : signer;
  const hasUserJoinedAlready = await hasUserJoinedPoll({
    maciAddress,
    pollId,
    nullifier,
    signer: nullifierReadSigner,
  });

  if (hasUserJoinedAlready) {
    throw new Error("User has already joined");
  }

  // Wallet signer is used ONLY for the joinPoll transaction below.
  const readSigner = readProvider ? Wallet.createRandom().connect(readProvider) : signer;

  // Reads + circuit inputs may hit flaky public RPCs; retry those only.
  // Proof generation and the join transaction run once — never re-enter after
  // submission. Post-submit confirmation can reconcile via receipt/nullifier.
  const { pollAddress, stateRootIndex, circuitInputs } = await withReadRetry(async () => {
    const maciContract = MACIFactory.connect(maciAddress, readSigner);
    const pollContracts = await maciContract.getPoll(pollId);
    const stateIndex = await maciContract.getStateIndex(userMaciPublicKey.hash()).catch(() => -1n);
    const stateTreeDepth = await maciContract.stateTreeDepth();

    const resolved = await resolvePinnedJoinInputs({
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
      provider: readProvider,
    });

    return {
      pollAddress: pollContracts.poll,
      stateRootIndex: resolved.stateRootIndex,
      circuitInputs: resolved.circuitInputs,
    };
  });

  const pollContract = PollFactory.connect(pollAddress, signer);

  const { proof } = await generateProofSnarkjs({
    inputs: circuitInputs,
    zkeyPath: pollJoiningZkey,
    wasmPath: pollWasm,
  });

  // submit once — do not retry this path
  const tx = await pollContract.joinPoll(
    nullifier,
    userMaciPublicKey.asContractParam(),
    stateRootIndex,
    formatProofForVerifierContract(proof),
    sgDataArg,
    ivcpDataArg,
  );

  let receipt;
  try {
    receipt = await tx.wait();
  } catch (error) {
    // Confirmation read failed after submission. Prefer membership reconcile
    // over reporting failure that might already be on-chain.
    const joined = await hasUserJoinedPoll({
      maciAddress,
      pollId,
      nullifier,
      signer: nullifierReadSigner,
    }).catch(() => false);
    if (!joined) {
      throw error;
    }
    throw new Error(
      `Join transaction submitted (${tx.hash}) but confirmation failed; membership appears on-chain. Reconcile before retrying.`,
    );
  }

  if (receipt?.status !== 1) {
    throw new Error("Transaction failed");
  }

  try {
    const [{ args }] = await pollContract.queryFilter(
      pollContract.filters.PollJoined,
      receipt.blockNumber,
      receipt.blockNumber,
    );

    return {
      pollStateIndex: args._pollStateIndex.toString(),
      voiceCredits: args._voiceCreditBalance.toString(),
      nullifier: nullifier.toString(),
      hash: receipt.hash,
    };
  } catch (error) {
    // Receipt succeeded but log query failed — surface hash for reconcile.
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Join confirmed (${receipt.hash}) but PollJoined log query failed: ${message}`);
  }
};
