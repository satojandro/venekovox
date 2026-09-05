import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserProvider, isAddress, type Eip1193Provider } from "ethers";
// Namespace imports are required for the workspace packages' CommonJS exports.
import * as maciSdk from "@maci-protocol/sdk/browser";
import * as domainobjs from "@maci-protocol/domainobjs";
import { createVoteFlow, type VoteProgress } from "./voteFlow";

const { Keypair, PrivateKey } = domainobjs as typeof import("@maci-protocol/domainobjs");
const KEYPAIR_STORAGE_KEY = "venekovox_maci_keypair";

function getConfig() {
  const maciAddress = import.meta.env.VITE_MACI_ADDRESS as string;
  const chainId = BigInt(import.meta.env.VITE_CHAIN_ID ?? "11155111");
  const pollId = BigInt(import.meta.env.VITE_POLL_ID ?? "0");
  const startBlock = Number(import.meta.env.VITE_MACI_START_BLOCK ?? "0");
  if (!isAddress(maciAddress) || chainId <= 0n || pollId < 0n || !Number.isSafeInteger(startBlock) || startBlock < 0) {
    throw new Error("The poll's network configuration is invalid.");
  }
  return { maciAddress, chainId, pollId, startBlock };
}

function getOrCreateKeypair(): InstanceType<typeof Keypair> {
  // Preserve existing demo keys; account-scoped key migration is a separate change.
  const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
  if (stored) {
    if (!PrivateKey.isValidSerialized(stored)) {
      throw new Error("The saved voting key is invalid. Restore your key before continuing.");
    }
    return new Keypair(PrivateKey.deserialize(stored));
  }
  const keypair = new Keypair();
  localStorage.setItem(KEYPAIR_STORAGE_KEY, keypair.privateKey.serialize());
  return keypair;
}

type WalletProvider = Eip1193Provider & {
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

async function getWallet() {
  const { chainId } = getConfig();
  const wallet = window.ethereum;
  if (!wallet) throw new Error("No wallet found. Please install MetaMask or Rainbow.");
  const assertChain = async () => {
    const currentChain = await wallet.request({ method: "eth_chainId" });
    if (BigInt(currentChain) !== chainId) {
      throw new Error(`Switch your wallet to the poll's network (chain ${chainId}) and try again.`);
    }
  };
  await assertChain();
  const provider = new BrowserProvider(wallet);
  await provider.send("eth_requestAccounts", []);
  await assertChain();
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  return { wallet, signer, account, assertChain };
}

export function useMaci() {
  const [state, setState] = useState<VoteProgress>({ account: null, status: "idle" });
  const mounted = useRef(true);
  const generation = useRef(0);
  const flow = useRef<ReturnType<typeof createVoteFlow> | null>(null);
  const activeGeneration = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const wallet = window.ethereum;
    const reset = () => {
      generation.current += 1;
      setState({ account: null, status: "idle" });
    };
    wallet?.on?.("accountsChanged", reset);
    wallet?.on?.("chainChanged", reset);
    return () => {
      mounted.current = false;
      generation.current += 1;
      wallet?.removeListener?.("accountsChanged", reset);
      wallet?.removeListener?.("chainChanged", reset);
    };
  }, []);

  if (!flow.current) {
    flow.current = createVoteFlow({
      sdk: maciSdk,
      getConfig,
      getSession: async () => {
        const snapshot = activeGeneration.current;
        const { wallet, signer, account, assertChain } = await getWallet();
        const assertCurrent = async () => {
          await assertChain();
          const accounts: string[] = await wallet.request({ method: "eth_accounts" });
          if (
            !mounted.current ||
            snapshot !== generation.current ||
            wallet !== window.ethereum ||
            accounts[0]?.toLowerCase() !== account.toLowerCase()
          ) {
            throw new Error("Your wallet changed. Reconnect and try again.");
          }
        };
        await assertCurrent();
        const keypair = getOrCreateKeypair();
        return {
          account,
          signer,
          publicKey: keypair.publicKey.serialize(),
          privateKey: keypair.privateKey.serialize(),
          assertCurrent,
        };
      },
      onProgress: (progress) => {
        if (mounted.current && activeGeneration.current === generation.current) setState(progress);
      },
    });
  }

  const connect = useCallback(async () => {
    if (busy.current) throw new Error("A wallet operation is already in progress.");
    busy.current = true;
    const snapshot = generation.current;
    setState({ account: null, status: "connecting" });
    try {
      const { account } = await getWallet();
      if (mounted.current && snapshot === generation.current) setState({ account, status: "idle" });
      return account;
    } catch (error) {
      if (mounted.current && snapshot === generation.current) setState({ account: null, status: "idle" });
      throw error;
    } finally {
      busy.current = false;
    }
  }, []);

  const vote = useCallback(async (option: number, weight = 1n) => {
    if (busy.current) throw new Error("A wallet operation is already in progress.");
    busy.current = true;
    activeGeneration.current = generation.current;
    try {
      return await flow.current!(option, weight);
    } finally {
      busy.current = false;
    }
  }, []);

  return { ...state, connect, vote, isBusy: ["connecting", "signing-up", "joining", "voting"].includes(state.status) };
}
