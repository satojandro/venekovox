import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, isAddress, type Eip1193Provider } from "ethers";
// Namespace imports are required for the workspace packages' CommonJS exports.
import * as maciSdk from "@maci-protocol/sdk/browser";
import * as domainobjs from "@maci-protocol/domainobjs";
import { createVoteFlow, type SubmitResult, type VoteProgress, type VoteStatus } from "./voteFlow";
import { createReceiptStore, type VoteReceipt } from "../lib/receipts";
import {
  checkReceiptStatus,
  isRecheckable,
  type ReceiptCheckStatus,
  type ReceiptProvider,
} from "../lib/receiptStatus";
import {
  hydrationContextKey,
  runHydration,
  type HydrationWrite,
  type KeyState,
  type WalletPeek,
} from "../lib/hydration";

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

/**
 * Read-only key access for HYDRATION: unlike getOrCreateKeypair, this never
 * creates or writes a voting identity. Read-only restore must not silently
 * replace a missing key with a brand-new identity (G04). The vote flow still
 * creates a key on an explicit user action. Storage exceptions are an explicit
 * state so hydration cannot get stuck outside its error handler.
 */
function readKeypair(): KeyState {
  try {
    const stored = localStorage.getItem(KEYPAIR_STORAGE_KEY);
    if (!stored) return { missing: true };
    if (!PrivateKey.isValidSerialized(stored)) return { invalid: true };
    return { publicKey: new Keypair(PrivateKey.deserialize(stored)).publicKey.serialize() };
  } catch {
    return { storageError: true };
  }
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
 * (eth_accounts never pops a modal). The result distinguishes the cases that
 * matter for honest hydration: no wallet installed, wallet present but nothing
 * connected, a probe error, or a usable connected account. All null-cases used
 * to collapse into "disconnected" (G03).
 */
export type { WalletPeek };

async function peekWallet(): Promise<WalletPeek> {
  const wallet = window.ethereum;
  if (!wallet) return { kind: "no-provider" };
  try {
    const accounts: string[] = await wallet.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) return { kind: "not-connected" };
    const chainId = BigInt(await wallet.request({ method: "eth_chainId" }));
    return { kind: "found", account: accounts[0], chainId };
  } catch {
    return { kind: "error" };
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

function asReceiptProvider(wallet: WalletProvider): ReceiptProvider {
  const provider = new BrowserProvider(wallet);
  return {
    async getTransactionReceipt(hash) {
      const receipt = await provider.getTransactionReceipt(hash);
      if (!receipt) return null;
      return {
        status: receipt.status,
        to: receipt.to,
        from: receipt.from,
        logs: receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics] })),
      };
    },
    async call(to, data) {
      return provider.call({ to, data });
    },
  };
}

/**
 * What the chain says about THIS wallet's participation in THIS poll.
 * `lookup-failed` is a distinct state: a failed chain lookup must NEVER be read
 * as "not registered" — it means we don't know (Astra hydration spec).
 */
export interface Participation {
  status:
    | "checking"
    | "disconnected"
    | "wrong-chain" // wallet connected, but on a chain other than the poll's
    | "key-missing" // no MACI voting key on this device; nothing we can safely hydrate
    | "key-invalid" // stored key does not deserialize; recovery required
    | "key-storage-error" // localStorage threw while reading the key
    | "ready"
    | "lookup-failed";
  registered?: boolean;
  stateIndex?: string;
  pollStateIndex?: string;
  /** True only when a chain query itself failed; never set by a "no" answer. */
  lookupFailed?: boolean;
}

/** Statuses that mean a submission is in flight (not the terminal "voted"). */
const IN_FLIGHT_STATUSES: VoteStatus[] = ["connecting", "signing-up", "joining", "voting"];

export function useMaci() {
  const [state, setState] = useState<VoteProgress>({ account: null, status: "idle" });
  const [participation, setParticipation] = useState<Participation>({ status: "checking" });
  const [receipt, setReceipt] = useState<VoteReceipt | null>(null);
  /** The account the displayed receipt was validated for (receipts store no identity). */
  const [receiptAccount, setReceiptAccount] = useState<string | null>(null);
  /** What the chain said about the stored receipt (null = no receipt shown). */
  const [receiptStatus, setReceiptStatus] = useState<ReceiptCheckStatus | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const flow = useRef<ReturnType<typeof createVoteFlow> | null>(null);
  const activeGeneration = useRef(0);
  const busy = useRef(false);
  const statusRef = useRef<VoteStatus>("idle");
  const rechecking = useRef(false);
  // Contexts already hydrated: `${chainId}:${account}` — prevents duplicate
  // lookups without blocking re-hydration for a DIFFERENT context.
  const hydratedFor = useRef<string | null>(null);
  const inFlightFor = useRef<string | null>(null);
  const receiptStore = useMemo(() => createReceiptStore(), []);

  const setProgress = useCallback((progress: VoteProgress) => {
    statusRef.current = progress.status;
    setState(progress);
  }, []);

  const applyHydrationWrite = useCallback(
    (write: HydrationWrite) => {
      switch (write.type) {
        case "disconnected":
          hydratedFor.current = null;
          setProgress({ account: null, status: "idle" });
          setParticipation({ status: "disconnected" });
          setReceipt(null);
          setReceiptAccount(null);
          setReceiptStatus(null);
          return;
        case "probe-error":
          setParticipation({ status: "lookup-failed", lookupFailed: true });
          return;
        case "wrong-chain":
          setProgress({ account: write.account, status: "idle" });
          setParticipation({ status: "wrong-chain" });
          return;
        case "checking":
          // Keep any live receipt: this write only identifies the account.
          setProgress({ account: write.account, status: statusRef.current === "voted" ? "voted" : "idle" });
          setParticipation({ status: "checking" });
          return;
        case "key-missing":
          setProgress({ account: write.account, status: "idle" });
          setParticipation({ status: "key-missing" });
          return;
        case "key-invalid":
          setProgress({ account: write.account, status: "idle" });
          setParticipation({ status: "key-invalid" });
          return;
        case "key-storage-error":
          setProgress({ account: write.account, status: "idle" });
          setParticipation({ status: "key-storage-error" });
          return;
        case "ready":
          setProgress({
            account: write.account,
            status: statusRef.current === "voted" ? "voted" : "idle",
            stateIndex: write.stateIndex,
            pollStateIndex: write.pollStateIndex,
          });
          setParticipation({
            status: "ready",
            registered: write.registered,
            stateIndex: write.stateIndex,
            pollStateIndex: write.pollStateIndex,
          });
          return;
        case "lookup-failed":
          setProgress({ account: write.account, status: "idle" });
          setParticipation({ status: "lookup-failed", registered: write.registered, lookupFailed: true });
          return;
        case "receipt":
          setReceipt(write.receipt);
          setReceiptAccount(write.account);
          setReceiptStatus(write.status);
          return;
      }
    },
    [setProgress],
  );

  /**
   * Restore participation + receipt from the chain and storage for whatever
   * wallet is ALREADY connected. Every state write is guarded so a stale
   * hydration can never overwrite a newer submission (busy / generation /
   * in-flight-status checks at the moment of application).
   */
  const hydrate = useCallback(async () => {
    const snapshot = generation.current;
    const canApply = () =>
      mounted.current &&
      snapshot === generation.current &&
      !busy.current &&
      !IN_FLIGHT_STATUSES.includes(statusRef.current);

    await runHydration({
      canApply,
      contextKey: hydrationContextKey,
      isHydratedFor: (key) => hydratedFor.current === key,
      isInFlightFor: (key) => inFlightFor.current === key,
      beginFlight: (key) => {
        if (snapshot === generation.current) inFlightFor.current = key;
      },
      endFlight: (key) => {
        if (snapshot === generation.current && inFlightFor.current === key) inFlightFor.current = null;
      },
      markHydrated: (key) => {
        if (snapshot === generation.current) hydratedFor.current = key;
      },
      clearHydrated: () => {
        if (snapshot === generation.current) hydratedFor.current = null;
      },
      peekWallet,
      getConfig,
      readKey: readKeypair,
      lookupParticipation: async ({ publicKey, maciAddress, pollId }) => {
        const wallet = window.ethereum;
        if (!wallet) throw new Error("No wallet found.");
        const provider = new BrowserProvider(wallet);
        const signer = await provider.getSigner();
        const config = getConfig();
        const signupData = await maciSdk.getSignedupUserData({
          maciAddress,
          maciPublicKey: publicKey,
          signer,
        });
        const joinedData = await maciSdk.getJoinedUserData({
          maciAddress,
          pollId,
          pollPublicKey: publicKey,
          signer,
          startBlock: config.startBlock,
        });
        return {
          registered: signupData.isRegistered,
          stateIndex: signupData.stateIndex,
          isJoined: joinedData.isJoined,
          pollStateIndex: joinedData.pollStateIndex,
        };
      },
      loadReceipt: (context) => receiptStore.load(context),
      checkReceipt: async ({ txHash, maciAddress, pollId, account }) => {
        const wallet = window.ethereum;
        if (!wallet) throw new Error("No wallet found.");
        return checkReceiptStatus({
          provider: asReceiptProvider(wallet),
          txHash,
          maciAddress,
          pollId,
          account,
        });
      },
      apply: applyHydrationWrite,
    });
  }, [applyHydrationWrite, receiptStore]);

  const verifyDisplayedReceipt = useCallback(
    async (args: { txHash: string; maciAddress: string; pollId: bigint; account: string; generation: number }) => {
      const wallet = window.ethereum;
      if (!wallet || !mounted.current || args.generation !== generation.current) return;
      try {
        const result = await checkReceiptStatus({
          provider: asReceiptProvider(wallet),
          txHash: args.txHash,
          maciAddress: args.maciAddress,
          pollId: args.pollId,
          account: args.account,
        });
        if (mounted.current && args.generation === generation.current) {
          setReceiptStatus(result.status);
        }
      } catch {
        if (mounted.current && args.generation === generation.current) {
          setReceiptStatus("unavailable");
        }
      }
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    const wallet = window.ethereum;
    const reset = () => {
      generation.current += 1;
      hydratedFor.current = null;
      inFlightFor.current = null;
      setProgress({ account: null, status: "idle" });
      setParticipation({ status: "checking" });
      setReceipt(null);
      setReceiptAccount(null);
      setReceiptStatus(null);
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
          setReceiptStatus("unverified");
          // The SDK already waited for the receipt; verify publication now so
          // the user does not need a reload to leave "unverified".
          void verifyDisplayedReceipt({
            txHash: value.txHash,
            maciAddress: context.maciAddress,
            pollId: context.pollId,
            account: context.account,
            generation: activeGeneration.current,
          });
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
      return account;
    } catch (error) {
      if (mounted.current && snapshot === generation.current) setProgress({ account: null, status: "idle" });
      throw error;
    } finally {
      busy.current = false;
      // Hydrate only after the busy flag is released, otherwise canApply
      // rejects every write and can still set the "already hydrated" marker.
      if (mounted.current && snapshot === generation.current) {
        hydratedFor.current = null;
        void hydrate();
      }
    }
  }, [hydrate, setProgress]);

  const vote = useCallback(
    async (option: number, weight = 1n): Promise<SubmitResult> => {
      if (busy.current) throw new Error("A wallet operation is already in progress.");
      busy.current = true;
      activeGeneration.current = generation.current;
      try {
        return await flow.current!(option, weight);
      } finally {
        busy.current = false;
        if (mounted.current) {
          // A vote creates a key and may change membership; allow a fresh lookup.
          hydratedFor.current = null;
          void hydrate();
        }
      }
    },
    [hydrate],
  );

  const recheckReceipt = useCallback(async () => {
    if (rechecking.current || busy.current || !receipt || !receiptAccount) return;
    if (!isRecheckable(receiptStatus)) return;
    const snapshot = generation.current;
    const stored = receipt;
    const account = receiptAccount;
    rechecking.current = true;
    try {
      const { maciAddress, pollId } = getConfig();
      await verifyDisplayedReceipt({
        txHash: stored.txHash,
        maciAddress,
        pollId,
        account,
        generation: snapshot,
      });
    } catch {
      if (mounted.current && snapshot === generation.current) setReceiptStatus("unavailable");
    } finally {
      rechecking.current = false;
    }
  }, [receipt, receiptAccount, receiptStatus, verifyDisplayedReceipt]);

  return {
    ...state,
    participation,
    receipt,
    receiptStatus,
    receiptAccount,
    connect,
    vote,
    recheckReceipt,
    canRecheck: isRecheckable(receiptStatus),
    isBusy: IN_FLIGHT_STATUSES.includes(state.status),
  };
}
