import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, isAddress, type Eip1193Provider } from "ethers";
// Namespace imports are required for the workspace packages' CommonJS exports.
import * as maciSdk from "@maci-protocol/sdk/browser";
import * as domainobjs from "@maci-protocol/domainobjs";
import { createVoteFlow, type SubmitResult, type VoteProgress, type VoteStatus } from "./voteFlow";
import { createReceiptStore, type VoteReceipt } from "../lib/receipts";

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

/**
 * Read-only wallet probe: inspects an ALREADY-connected wallet without prompting
 * (eth_accounts never pops a modal). Returns null when no wallet is installed or
 * nothing is connected — that is "nothing to restore", not a failure.
 */
async function peekWallet(): Promise<{ wallet: WalletProvider; account: string; chainId: bigint } | null> {
  const wallet = window.ethereum;
  if (!wallet) return null;
  try {
    const accounts: string[] = await wallet.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) return null;
    const chainId = BigInt(await wallet.request({ method: "eth_chainId" }));
    return { wallet, account: accounts[0], chainId };
  } catch {
    return null;
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

/**
 * What the chain says about THIS wallet's participation in THIS poll.
 * `lookup-failed` is a distinct state: a failed chain lookup must NEVER be read
 * as "not registered" — it means we don't know (Astra hydration spec).
 */
export interface Participation {
  status: "checking" | "disconnected" | "ready" | "lookup-failed";
  registered?: boolean;
  stateIndex?: string;
  pollStateIndex?: string;
  /** True only when a chain query itself failed; never set by a "no" answer. */
  lookupFailed?: boolean;
}

/** Statuses that mean a submission is in flight or has just completed. */
const SUBMISSION_STATUSES: VoteStatus[] = ["connecting", "signing-up", "joining", "voting", "voted"];

export function useMaci() {
  const [state, setState] = useState<VoteProgress>({ account: null, status: "idle" });
  const [participation, setParticipation] = useState<Participation>({ status: "checking" });
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  /** The account the displayed receipt was validated for (receipts store no identity). */
  const [receiptAccount, setReceiptAccount] = useState<string | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const flow = useRef<ReturnType<typeof createVoteFlow> | null>(null);
  const activeGeneration = useRef(0);
  const busy = useRef(false);
  const statusRef = useRef<VoteStatus>("idle");
  // Contexts already hydrated (or hydrating): `${chainId}:${account}` — prevents
  // duplicate lookups without blocking re-hydration for a DIFFERENT context.
  const hydratedFor = useRef<string | null>(null);
  const receiptStore = useMemo(() => createReceiptStore(), []);

  const setProgress = useCallback((progress: VoteProgress) => {
    statusRef.current = progress.status;
    setState(progress);
  }, []);

  /**
   * Restore participation + receipt from the chain and storage for whatever
   * wallet is ALREADY connected. Every state write is guarded so a stale
   * hydration can never overwrite a newer submission (busy / generation /
   * submission-status checks at the moment of application).
   */
  const hydrate = useCallback(async () => {
    const snapshot = generation.current;
    // A write is safe only if: still mounted, no wallet/reset since we started,
    // nothing in flight, and no completed submission to clobber.
    const canApply = () =>
      mounted.current &&
      snapshot === generation.current &&
      !busy.current &&
      !SUBMISSION_STATUSES.includes(statusRef.current);

    setProgress({ account: null, status: "idle" });
    setParticipation({ status: "checking" });
    setReceipt(null);

    const peek = await peekWallet();
    if (!peek) {
      if (canApply()) {
        setParticipation({ status: "disconnected" });
        hydratedFor.current = null; // retry when a wallet connects
      }
      return;
    }
    const { wallet, account, chainId } = peek;
    const contextKey = `${chainId.toString()}:${account.toLowerCase()}`;
    if (hydratedFor.current === contextKey) return;
    hydratedFor.current = contextKey;
    if (canApply()) setProgress({ account, status: "idle" });

    let registered: boolean | undefined;
    try {
      const config = getConfig();
      const provider = new BrowserProvider(wallet);
      const signer = await provider.getSigner();
      const publicKey = getOrCreateKeypair().publicKey.serialize();

      const signupData = await maciSdk.getSignedupUserData({
        maciAddress: config.maciAddress,
        maciPublicKey: publicKey,
        signer,
      });
      registered = signupData.isRegistered;
      if (!canApply()) return;

      const joinedData = await maciSdk.getJoinedUserData({
        maciAddress: config.maciAddress,
        pollId: config.pollId,
        pollPublicKey: publicKey,
        signer,
        startBlock: config.startBlock,
      });
      if (!canApply()) return;
      setParticipation({
        status: "ready",
        registered,
        stateIndex: signupData.stateIndex,
        pollStateIndex: joinedData.isJoined ? joinedData.pollStateIndex : undefined,
      });
    } catch {
      // The chain did not answer. Report not-knowing — never "not registered".
      if (canApply()) {
        setParticipation({ status: "lookup-failed", registered, lookupFailed: true });
      }
      // No receipt can be validated without a confirmed context; leave unset —
      // "unable to confirm", per the receipt contract.
      return;
    }

    // Receipt recovery: load under the exact context this hydration verified.
    try {
      const config = getConfig();
      const stored = receiptStore.load({
        chainId,
        maciAddress: config.maciAddress,
        pollId: config.pollId,
        account,
      });
      if (stored && canApply()) {
        setReceipt(stored);
        setReceiptAccount(account);
      }
    } catch {
      // getConfig failure here means misconfiguration; participation state above
      // already reflects the chain truth, so do not downgrade it.
    }
  }, [receiptStore, setProgress]);

  useEffect(() => {
    mounted.current = true;
    const wallet = window.ethereum;
    const reset = () => {
      generation.current += 1;
      hydratedFor.current = null;
      setProgress({ account: null, status: "idle" });
      setParticipation({ status: "checking" });
      setReceipt(null);
      setReceiptAccount(null);
      // Re-hydrate for whatever context the wallet switched to.
      void hydrate();
    };
    wallet?.on?.("accountsChanged", reset);
    wallet?.on?.("chainChanged", reset);
    void hydrate();
    return () => {
      mounted.current = false;
      generation.current += 1;
      wallet?.removeListener?.("accountsChanged", reset);
      wallet?.removeListener?.("chainChanged", reset);
    };
  }, [hydrate, setProgress]);

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
        if (mounted.current && activeGeneration.current === generation.current) setProgress(progress);
      },
      onReceipt: (context, value) => {
        // Persist under the context CAPTURED AT SUBMISSION START: a wallet
        // switch mid-flight can never file A's vote under B (Astra regression).
        receiptStore.save(context, value);
        // Display only if the submission still belongs to the live generation.
        if (mounted.current && activeGeneration.current === generation.current) {
          setReceipt(value);
          setReceiptAccount(context.account);
        }
      },
    });
  }

  const connect = useCallback(async () => {
    if (busy.current) throw new Error("A wallet operation is already in progress.");
    busy.current = true;
    const snapshot = generation.current;
    setProgress({ account: null, status: "connecting" });
    try {
      const { account } = await getWallet();
      if (mounted.current && snapshot === generation.current) setProgress({ account, status: "idle" });
      // A manual connect is a context change: restore participation + receipt.
      hydratedFor.current = null;
      void hydrate();
      return account;
    } catch (error) {
      if (mounted.current && snapshot === generation.current) setProgress({ account: null, status: "idle" });
      throw error;
    } finally {
      busy.current = false;
    }
  }, [hydrate, setProgress]);

  const vote = useCallback(async (option: number, weight = 1n): Promise<SubmitResult> => {
    if (busy.current) throw new Error("A wallet operation is already in progress.");
    busy.current = true;
    activeGeneration.current = generation.current;
    try {
      return await flow.current!(option, weight);
    } finally {
      busy.current = false;
    }
  }, []);

  return {
    ...state,
    participation,
    receipt,
    receiptAccount,
    connect,
    vote,
    isBusy: SUBMISSION_STATUSES.slice(0, 4).includes(state.status),
  };
}
