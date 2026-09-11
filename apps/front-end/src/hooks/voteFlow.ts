import type { JsonRpcSigner, Provider, Signer } from "ethers";
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

/** Read-only RPC access for membership lookups and join prep. Injected so unit
 *  tests can load this module without resolving ethers providers or Vite env. */
export interface VoteReadAccess {
  signer: Signer;
  /** Optional multi-RPC provider for joinPoll's state-tree scan. */
  provider?: Provider;
}

interface VoteFlowOptions {
  sdk: VoteSdk;
  getSession: () => Promise<VoteSession>;
  getConfig: () => { maciAddress: string; pollId: bigint; startBlock: number; chainId: bigint };
  onProgress: (progress: VoteProgress) => void;
  /** Called once the publish transaction is confirmed, BEFORE success is reported. */
  onReceipt?: (context: SubmitContext, receipt: VoteReceipt) => void;
  /**
   * Join gate bytes for Poll.joinPoll(..., _signUpPolicyData).
   * The MACI SDK names this `sgDataArg`. Signup `sgData` stays 0x until WP0
   * binds SelfEligibilityPolicy on MACI.signup as well.
   */
  getSignUpPolicyData?: (account: string) => string | Promise<string>;
  /** eth_call the policy.enforce path BEFORE the wallet is asked to sign join. */
  dryRunJoin?: (args: {
    account: string;
    sgDataArg: string;
    signer: JsonRpcSigner;
    maciAddress: string;
    pollId: bigint;
  }) => Promise<void>;
  /**
   * Read-optimized signer/provider for lookups. When omitted, the wallet
   * signer is used (tests). Production wires makeReadProvider via useMaci.
   */
  getReadAccess?: (chainId: bigint) => VoteReadAccess | Promise<VoteReadAccess>;
  /**
   * Preferred join path: backend inclusion proof + pinned stateRootIndex.
   * Return null to let joinPoll try subgraph StateLeaves, then RPC.
   * Both fallbacks still pin stateRootIndex from the tree that built the proof.
   */
  prepareJoinWitness?: (args: { maciAddress: string; publicKey: string; privateKey: string }) => Promise<{
    inclusionProof: {
      root: bigint;
      leaf: bigint;
      index: number;
      siblings: bigint[];
    };
    stateRootIndex: number;
  } | null>;
}

/** Retry a read-only SDK step. Free public RPCs load-balance across backend
 *  nodes; a lagging replica can revert getPoll/getStateIndex with empty data
 *  (CALL_EXCEPTION) or 429 mid-scan. Only wrap calls that cannot submit a
 *  transaction — never joinPoll/signup/publish. Exponential backoff. */
async function withRpcRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
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
      if (!transient || attempt === attempts) throw error;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

/** One invocation owns signup, join and publish. React state is display-only. */
export function createVoteFlow({
  sdk,
  getSession,
  getConfig,
  onProgress,
  onReceipt,
  getSignUpPolicyData,
  dryRunJoin,
  getReadAccess,
  prepareJoinWitness,
}: VoteFlowOptions) {
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
      // Registration lookup is read-only. Prefer the injected read RPC; fall
      // back to the wallet signer in tests that omit getReadAccess.
      const readAccess = getReadAccess ? await getReadAccess(chainId) : { signer, provider: undefined };
      const registered = await sdk.getSignedupUserData({
        maciAddress,
        maciPublicKey: publicKey,
        signer: readAccess.signer,
      });
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
      // Read-only — safe to retry. getJoinedUserData calls getPoll(pollId),
      // which wallet nodes intermittently revert with empty data.
      const lookupJoined = () =>
        sdk.getJoinedUserData({
          maciAddress,
          pollId,
          pollPublicKey: publicKey,
          signer: readAccess.signer,
          startBlock,
        });
      const joined = await withRpcRetry(lookupJoined);
      let pollStateIndex = joined.pollStateIndex;
      if (!joined.isJoined) {
        await assertCurrent();
        report({ status: "joining" });
        // Poll.sol:388 — policy.enforce(msg.sender, _signUpPolicyData).
        // SDK argument name: sgDataArg.
        const sgDataArg = getSignUpPolicyData ? await getSignUpPolicyData(account) : "0x";
        if (dryRunJoin) {
          await dryRunJoin({ account, sgDataArg, signer, maciAddress, pollId });
        }
        // joinPoll submits a transaction. Do NOT wrap it in withRpcRetry —
        // a transient error after submission can re-enter join or report
        // failure after success. SDK retries reads/proof prep internally;
        // here we only reconcile membership if the call throws.
        try {
          let witness: {
            inclusionProof?: {
              root: bigint;
              leaf: bigint;
              index: number;
              siblings: bigint[];
            };
            stateRootIndex?: number;
          } = {};
          if (prepareJoinWitness) {
            const prepared = await prepareJoinWitness({ maciAddress, publicKey, privateKey });
            if (prepared) {
              witness = { inclusionProof: prepared.inclusionProof, stateRootIndex: prepared.stateRootIndex };
            }
          }
          const result = await sdk.joinPoll({
            maciAddress,
            pollId,
            privateKey,
            signer,
            startBlock,
            pollJoiningZkey: "/zkeys/PollJoining_10_test/PollJoining_10_test.0.zkey",
            pollWasm: "/zkeys/PollJoining_10_test/PollJoining_10_test.wasm",
            sgDataArg,
            ivcpDataArg: "0x",
            ...(readAccess.provider ? { provider: readAccess.provider } : {}),
            ...witness,
          });
          pollStateIndex = result.pollStateIndex;
        } catch (error) {
          const recovered = await withRpcRetry(lookupJoined).catch(() => null);
          if (recovered?.isJoined && recovered.pollStateIndex) {
            pollStateIndex = recovered.pollStateIndex;
          } else {
            throw error;
          }
        }
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
