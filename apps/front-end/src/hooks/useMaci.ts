import { useCallback, useState } from "react";
import { BrowserProvider, type Eip1193Provider } from "ethers";
// Namespace imports: these CJS packages use Object.defineProperty getters that
// break rollup's named-export static analysis
import * as maciSdk from "@maci-protocol/sdk";
import * as domainobjs from "@maci-protocol/domainobjs";
const {
  signup: maciSignup,
  hasUserSignedUp,
  getSignedupUserData,
  joinPoll,
  publish,
  getPollContracts,
} = maciSdk as typeof import("@maci-protocol/sdk");
const { Keypair, PrivateKey } = domainobjs as typeof import("@maci-protocol/domainobjs");

const MACI_ADDRESS = import.meta.env.VITE_MACI_ADDRESS as string;
const POLL_ID = Number(import.meta.env.VITE_POLL_ID ?? 0);
const KEYPAIR_STORAGE_KEY = "venekovox_maci_keypair";

export type MaciStatus = "idle" | "connecting" | "signing-up" | "joining" | "ready" | "voting" | "voted";

interface MaciState {
  account: string | null;
  status: MaciStatus;
  stateIndex?: string;
  pollStateIndex?: string;
}

/**
 * Derives (or restores) the user's MACI keypair.
 * The MACI private key is a babyjubjub key, separate from the wallet key.
 * We persist it in localStorage so votes remain consistent across sessions.
 */
function getOrCreateKeypair(): InstanceType<typeof Keypair> {
  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
  if (stored && PrivateKey.isValidSerialized(stored)) {
    return new Keypair(PrivateKey.deserialize(stored));
  }
  const keypair = new Keypair();
  localStorage.setItem(KEYPAIR_STORAGE_KEY, keypair.privateKey.serialize());
  return keypair;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

async function getSigner(): Promise<{ signer: any; account: string }> {
  if (!window.ethereum) {
    throw new Error("No wallet found. Please install MetaMask or Rainbow.");
  }
  const provider = new BrowserProvider(window.ethereum as Eip1193Provider);
  const accounts = await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  return { signer, account: accounts[0] };
}

export function useMaci() {
  const [state, setState] = useState<MaciState>({ account: null, status: "idle" });

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, status: "connecting" }));
    try {
      const { account } = await getSigner();
      setState({ account, status: "idle" });
      return account;
    } catch (err) {
      setState((s) => ({ ...s, status: "idle" }));
      throw err;
    }
  }, []);

  /** Step 1 — sign up to MACI (one-time per wallet) */
  const signup = useCallback(async () => {
    setState((s) => ({ ...s, status: "signing-up" }));
    try {
      const { signer } = await getSigner();
      const keypair = getOrCreateKeypair();

      // skip if already signed up
      const registered = await hasUserSignedUp({
        maciAddress: MACI_ADDRESS,
        maciPublicKey: keypair.publicKey.serialize(),
        signer,
      });

      let stateIndex: string | undefined;
      if (!registered) {
        const data = await maciSignup({
          maciPublicKey: keypair.publicKey.serialize(),
          maciAddress: MACI_ADDRESS,
          sgData: "0x0",
          signer,
        });
        stateIndex = String(data.stateIndex);
      } else {
        const userData = await getSignedupUserData({
          maciAddress: MACI_ADDRESS,
          maciPublicKey: keypair.publicKey.serialize(),
          signer,
        });
        stateIndex = userData.stateIndex;
      }

      setState((s) => ({ ...s, status: "idle", stateIndex }));
      return stateIndex;
    } catch (err) {
      setState((s) => ({ ...s, status: "idle" }));
      throw err;
    }
  }, []);

  /** Step 2 — join the poll (proves membership; zk-proof runs in-browser via WASM) */
  const joinPollFlow = useCallback(async () => {
    setState((s) => ({ ...s, status: "joining" }));
    try {
      const { signer } = await getSigner();
      const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
      if (!stored || !PrivateKey.isValidSerialized(stored)) {
        throw new Error("Sign up first");
      }

      const data = await joinPoll({
        maciAddress: MACI_ADDRESS,
        privateKey: stored,
        pollId: BigInt(POLL_ID),
        signer,
        startBlock: 0,
        pollJoiningZkey: "/zkeys/PollJoining_10_test/PollJoining_10_test.0.zkey",
        pollWasm: "/zkeys/PollJoining_10_test/PollJoining_10_test.wasm",
        sgDataArg: "0x0",
        ivcpDataArg: "0x0",
      });

      setState((s) => ({ ...s, status: "ready", pollStateIndex: data.pollStateIndex }));
      return data;
    } catch (err) {
      setState((s) => ({ ...s, status: "idle" }));
      throw err;
    }
  }, []);

  /** Step 3 — publish an encrypted vote on-chain */
  const vote = useCallback(
    async (voteOptionIndex: number, newVoteWeight = 1n) => {
      setState((s) => ({ ...s, status: "voting" }));
      try {
        const { signer } = await getSigner();
        const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
        if (!stored || !PrivateKey.isValidSerialized(stored)) throw new Error("Not joined");
        if (!state?.pollStateIndex) throw new Error("Join the poll before voting");

        const keypair = new Keypair(PrivateKey.deserialize(stored));

        const data = await publish({
          stateIndex: BigInt(state.pollStateIndex),
          voteOptionIndex: BigInt(voteOptionIndex),
          nonce: 1n,
          pollId: BigInt(POLL_ID),
          newVoteWeight,
          maciAddress: MACI_ADDRESS,
          salt: undefined,
          publicKey: keypair.publicKey.serialize(),
          privateKey: stored,
          signer,
        });

        setState((s) => ({ ...s, status: "voted" }));
        return data;
      } catch (err) {
        setState((s) => ({ ...s, status: "ready" }));
        throw err;
      }
    },
    [state?.pollStateIndex],
  );

  return {
    ...state,
    connect,
    signup,
    joinPollFlow,
    vote,
    isEligibleToVote: state.status === "ready",
  };
}
