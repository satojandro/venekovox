/* eslint-disable no-underscore-dangle */
import { MACI__factory as MACIFactory, Poll__factory as PollFactory } from "@maci-protocol/contracts/typechain-types";
import { poseidon } from "@maci-protocol/crypto";
import { Keypair, PrivateKey } from "@maci-protocol/domainobjs";

import type { IJoinPollData, IJoinPollArgs } from "./types";
import type { TCircuitInputs } from "../utils/types";
import type { Provider } from "ethers";

import { contractExists } from "../utils/contracts";
import { generateAndVerifyProof } from "../utils/proofs";

import { preparePollJoiningFromEvents, getPollJoiningCircuitInputsFromStateFile, hasUserJoinedPoll } from "./utils";

/**
 * Join Poll user to the Poll contract
 * @param {IJoinPollArgs} args - The arguments for the join poll command
 * @returns {IJoinPollData} The poll state index of the joined user and transaction hash
 */
export const joinPoll = async ({
  maciAddress,
  privateKey,
  stateFile,
  pollId,
  signer,
  startBlock,
  endBlock,
  blocksPerBatch,
  pollJoiningZkey,
  useWasm,
  rapidsnark,
  pollWitnessGenerator,
  pollWasm,
  sgDataArg,
  ivcpDataArg,
  // Optional read-optimized provider: the state-tree rebuild fires hundreds of
  // eth_getLogs calls and wallet RPCs (MetaMask/Infura) rate-limit that burst
  // (-32005). Reads go here (e.g. a public JsonRpcProvider); the wallet signer
  // is used only for the joinPoll transaction.
  provider: readProvider,
}: IJoinPollArgs & { provider?: Provider }): Promise<IJoinPollData> => {
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

  // check if the user has already joined the poll based on the nullifier
  const hasUserJoinedAlready = await hasUserJoinedPoll({
    maciAddress,
    pollId,
    nullifier,
    signer,
  });

  if (hasUserJoinedAlready) {
    throw new Error("User has already joined");
  }

  const maciContract = MACIFactory.connect(maciAddress, signer);
  const pollContracts = await maciContract.getPoll(pollId);
  const pollContract = PollFactory.connect(pollContracts.poll, signer);

  // get the state index from the MACI contract
  const stateIndex = await maciContract.getStateIndex(userMaciPublicKey.hash()).catch(() => -1n);

  let circuitInputs: TCircuitInputs;
  let pinnedStateRootIndex: number;

  if (stateFile) {
    circuitInputs = await getPollJoiningCircuitInputsFromStateFile({
      stateFile,
      pollId,
      stateIndex,
      userMaciPrivateKey,
    });
    const file = await (await import("fs")).promises.readFile(stateFile);
    const content = JSON.parse(file.toString()) as { publicKeys?: unknown[] };
    pinnedStateRootIndex = (content.publicKeys?.length ?? 1) - 1;
  } else {
    const prepared = await preparePollJoiningFromEvents({
      maciContract,
      stateIndex,
      pollId,
      userMaciPrivateKey,
      signer,
      startBlock,
      endBlock,
      blocksPerBatch,
      provider: readProvider,
    });
    circuitInputs = prepared.inputs;
    pinnedStateRootIndex = prepared.stateRootIndex;
  }

  const proof = await generateAndVerifyProof(
    circuitInputs,
    pollJoiningZkey,
    useWasm,
    rapidsnark,
    pollWitnessGenerator,
    pollWasm,
  );

  // submit the message onchain as well as the encryption public key
  const tx = await pollContract.joinPoll(
    nullifier,
    userMaciPublicKey.asContractParam(),
    pinnedStateRootIndex,
    proof,
    sgDataArg,
    ivcpDataArg,
  );
  const receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error("Transaction failed");
  }

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
};
