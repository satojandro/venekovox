import type { JsonRpcSigner } from "ethers";
import type { VoteReceipt } from "../lib/receipts";

export type VoteStatus = "idle" | "connecting" | "signing-up" | "joining" | "ready" | "voting" | "voted";
export interface VoteProgress {
  account: string | null;
  status: VoteStatus;
  stateIndex?: string;
  pollStateIndex?: string;
}

// The wallet/contract context a submission belongs to. Captured when the
// submission STARTS so a receipt can never migrate to a different wallet,
// chain, contract or poll if the user switches mid-flight (Astra regression #2).
export interface SubmitContext {
  chainId: bigint;
  maciAddress: string;
  pollId: bigint;
  account: string;
}

export interface SubmitResult extends SubmitContext {
  hash: string;
}

interface VoteSession {
  account: string;
  signer: JsonRpcSigner;
  publicKey: string;
  privateKey: string;
  assertCurrent: () => Promise<void>;
}

type VoteSdk = Pick<
  typeof import("@maci-protocol/sdk/browser"),
  "getSignedupUserData" | "signup" | "getJoinedUserData" | "joinPoll" | "publish"
>;

interface VoteFlowOptions {
  sdk: VoteSdk;
  getSession: () => Promise<VoteSession>;
  getConfig: () => { maciAddress: string; pollId: bigint; startBlock: number; chainId: bigint };
  onProgress: (progress: VoteProgress) => void;
  /** Called once the publish transaction is confirmed, BEFORE success is reported. */
  onReceipt?: (context: SubmitContext, receipt: VoteReceipt) => void;
}

/** One invocation owns signup, join and publish. React state is display-only. */
export function createVoteFlow({ sdk, getSession, getConfig, onProgress, onReceipt }: VoteFlowOptions) {
  let busy = false;

  return async (voteOptionIndex: number, newVoteWeight = 1n): Promise<SubmitResult> => {
    // Synchronous lock: two clicks in the same render cannot start two transactions.
    if (busy) throw new Error("A vote submission is already in progress.");
    busy = true;
    let progress: VoteProgress = { account: null, status: "connecting" };
    const report = (change: Partial<VoteProgress>) => {
      progress = { ...progress, ...change };
      onProgress(progress);
    };

    try {
      if (!Number.isSafeInteger(voteOptionIndex) || voteOptionIndex < 0 || newVoteWeight <= 0n) {
        throw new Error("Invalid vote option or weight.");
      }
      // Capture the full context up front — every receipt and guard uses THIS
      // snapshot, not whatever the wallet happens to be when the tx resolves.
      const { maciAddress, pollId, startBlock, chainId } = getConfig();
      const context: SubmitContext = { chainId, maciAddress, pollId, account: "" };
      report({});
      const session = await getSession();
      const { account, signer, publicKey, privateKey, assertCurrent } = session;
      context.account = account;
      report({ account });
      await assertCurrent();

      const signupArgs = { maciAddress, maciPublicKey: publicKey, signer };
      const registered = await sdk.getSignedupUserData(signupArgs);
      let stateIndex = registered.stateIndex;
      if (!registered.isRegistered) {
        await assertCurrent();
        report({ status: "signing-up" });
        const signup = await sdk.signup({ ...signupArgs, sgData: "0x" });
        stateIndex = signup.stateIndex;
      }
      if (!stateIndex || BigInt(stateIndex) <= 0n) throw new Error("Could not confirm MACI registration.");
      report({ stateIndex });
      await assertCurrent();

      // Recover membership from the chain after refresh or a failed publish.
      const joined = await sdk.getJoinedUserData({
        maciAddress,
        pollId,
        pollPublicKey: publicKey,
        signer,
        startBlock,
      });
      let pollStateIndex = joined.pollStateIndex;
      if (!joined.isJoined) {
        await assertCurrent();
        report({ status: "joining" });
        const result = await sdk.joinPoll({
          maciAddress,
          pollId,
          privateKey,
          signer,
          startBlock,
          pollJoiningZkey: "/zkeys/PollJoining_10_test/PollJoining_10_test.0.zkey",
          pollWasm: "/zkeys/PollJoining_10_test/PollJoining_10_test.wasm",
          sgDataArg: "0x",
          ivcpDataArg: "0x",
        });
        pollStateIndex = result.pollStateIndex;
      }
      if (!pollStateIndex || BigInt(pollStateIndex) <= 0n) throw new Error("Could not confirm poll membership.");
      report({ pollStateIndex, status: "ready" });
      await assertCurrent();
      report({ status: "voting" });
      const result = await sdk.publish({
        maciAddress,
        pollId,
        signer,
        privateKey,
        publicKey,
        stateIndex: BigInt(pollStateIndex),
        voteOptionIndex: BigInt(voteOptionIndex),
        newVoteWeight,
        nonce: 1n,
        salt: undefined,
      });
      // Persist the receipt under the CAPTURED context before reporting success,
      // so the confirmation UI is always backed by a stored receipt. Storage
      // failure must not fail an already-submitted on-chain vote; the honest
      // outcome of a failed save is "unable to confirm" after a reload.
      try {
        onReceipt?.({ ...context }, { txHash: result.hash, submittedAt: Date.now() });
      } catch {
        // Receipt persistence is best-effort; the submission itself stands.
      }
      report({ status: "voted" });
      // Do not leak the SDK's ephemeral encryption private key to the page.
      return { hash: result.hash, ...context };
    } catch (error) {
      report({ status: "idle" });
      throw error;
    } finally {
      busy = false;
    }
  };
}
