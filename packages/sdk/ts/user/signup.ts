import { MACI__factory as MACIFactory } from "@maci-protocol/contracts/typechain-types";
import { PublicKey } from "@maci-protocol/domainobjs";
import { type ContractTransactionReceipt, isBytesLike } from "ethers";

import type { IIsRegisteredUser, ISignupArgs, ISignupData, IRegisteredUserArgs, IHasUserSignedUpArgs } from "./types";

import { contractExists } from "../utils/contracts";

/**
 * Checks if user is registered with a given public key and get its data
 * @param IRegisteredArgs - The arguments for the check register command
 * @returns whether the user is registered or not and their state index
 */
export const getSignedupUserData = async ({
  maciAddress,
  maciPublicKey,
  signer,
}: IRegisteredUserArgs): Promise<IIsRegisteredUser> => {
  const maciContract = MACIFactory.connect(maciAddress, signer);
  const publicKey = PublicKey.deserialize(maciPublicKey);

  try {
    const stateIndex = await maciContract.getStateIndex(publicKey.hash());

    return {
      isRegistered: stateIndex !== 0n, // 0 index is reserved for deleted leaves
      stateIndex: String(stateIndex),
    };
  } catch (error) {
    // Check if this is a "UserNotSignedUp" maci contract error.
    // Ethers v6 surfaces a reverted view call as BAD_DATA with the raw 4-byte
    // selector (e.g. `invalid length for result data (value="0xb2d14184")`),
    // NOT as a decoded revert message — so match the code AND the selector,
    // otherwise a first-time voter crashes the lookup instead of signing up.
    const e = error as Error & { code?: string; data?: unknown };
    // This view call has exactly ONE revert path in MACI.sol (UserNotSignedUp),
    // but ethers v6 / RPC nodes surface it in multiple shapes:
    //   1. BAD_DATA with the raw selector ("invalid length ... 0xb2d14184")
    //   2. CALL_EXCEPTION with empty revert data ("missing revert data") when a
    //      node strips the reason
    //   3. a decoded revert message (classic)
    // A transport failure is a DIFFERENT error code (NETWORK_ERROR etc.), so
    // treating any revert of THIS call as "not registered" is sound.
    const isRevert =
      e.code === "CALL_EXCEPTION" ||
      (e instanceof Error && e.message.includes("UserNotSignedUp()")) ||
      e.message.includes("0xb2d14184");
    if (isRevert) {
      return {
        isRegistered: false,
        stateIndex: undefined,
      };
    }
    // If it's a different error, rethrow it
    throw error;
  }
};

/**
 * Signup a user to the MACI contract
 * @param {SignupArgs} args - The arguments for the signup command
 * @returns {ISignupData} The state index of the user and transaction hash
 */
export const signup = async ({ maciPublicKey, maciAddress, sgData, signer }: ISignupArgs): Promise<ISignupData> => {
  // validate user key
  if (!PublicKey.isValidSerialized(maciPublicKey)) {
    throw new Error("Invalid MACI public key");
  }

  const userMaciPublicKey = PublicKey.deserialize(maciPublicKey);

  const validContract = await contractExists(signer.provider!, maciAddress);

  if (!validContract) {
    throw new Error("There is no contract deployed at the specified address");
  }

  // we validate that the signup data and voice credit data is valid
  if (!isBytesLike(sgData)) {
    throw new Error("invalid signup gateway data");
  }

  const maciContract = MACIFactory.connect(maciAddress, signer);

  let stateIndex = "";
  let receipt: ContractTransactionReceipt | null = null;

  // sign up to the MACI contract
  const tx = await maciContract.signUp(userMaciPublicKey.asContractParam(), sgData);
  receipt = await tx.wait();

  if (receipt?.status !== 1) {
    throw new Error("The transaction failed");
  }

  // get state index from the event
  const [{ args = [] } = { args: [] }] = await maciContract.queryFilter(
    maciContract.filters.SignUp,
    receipt.blockNumber,
    receipt.blockNumber,
  );

  stateIndex = args[0].toString();

  return {
    stateIndex: stateIndex ? stateIndex.toString() : "",
    transactionHash: receipt.hash,
  };
};

/**
 * Checks if a user is signed up with a given public key
 * @param {IIsSignedUpArgs} args - The arguments for the is signed up command
 * @returns {boolean} Whether the user is signed up or not
 */
export const hasUserSignedUp = async ({
  maciAddress,
  maciPublicKey,
  signer,
}: IHasUserSignedUpArgs): Promise<boolean> => {
  const maciContract = MACIFactory.connect(maciAddress, signer);

  const stateIndex = await maciContract.getStateIndex(PublicKey.deserialize(maciPublicKey).hash());

  return stateIndex !== 0n;
};
