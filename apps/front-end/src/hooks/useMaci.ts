import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, isAddress, type Eip1193Provider } from "ethers";
// Namespace imports are required for the workspace packages' CommonJS exports.
import * as maciSdk from "@maci-protocol/sdk/browser";
import * as domainobjs from "@maci-protocol/domainobjs";
import { createVoteFlow, type SubmitResult, type VoteProgress, type VoteStatus } from "./voteFlow";
import { createReceiptStore, applySubmittedReceipt, type VoteReceipt } from "../lib/receipts";
import { checkReceiptStatus, isRecheckable, type ReceiptCheckStatus, type ReceiptProvider } from "../lib/receiptStatus";
import { selectWalletKind } from "../lib/wallet/adapter";
import { getInjectedWallet, peekWallet } from "../lib/wallet/injected";
import {
  createFlightAnchor,
  hydrationContextKey,
  invalidateFlight,
  runHydration,
  type FlightAnchor,
  type HydrationWrite,
  type KeyState,
} from "../lib/hydration";

const { Keypair, PrivateKey } = domainobjs as typeof import("@maci-protocol/domainobjs");
const KEYPAIR_STORAGE_KEY = "venekovox_maci_keypair";

function getConfig() {
  // D06 is provisional: Privy is the first experiment, not a wired adapter.
  selectWalletKind(import.meta.env.VITE_WALLET_SOURCE as string | undefined);
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

export type { WalletPeek } from "../lib/wallet/adapter";

async function getWallet() {
  const { chainId } = getConfig();
  return getInjectedWallet(chainId);
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
        contractAddress: receipt.contractAddress,
        logs: receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics] })),
      };
    },
    async getTransaction(hash) {
      const tx = await provider.getTransaction(hash);
      if (!tx) return null;
      return { to: tx.to, from: tx.from, data: tx.data };
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
  const operationId = useRef(0);
  const receiptRef = useRef<VoteReceipt | null>(null);
  const receiptAccountRef = useRef<string | null>(null);
  // Contexts already hydrated: `${chainId}:${account}` — prevents duplicate
  // lookups without blocking re-hydration for a DIFFERENT context.
  const hydratedFor = useRef<string | null>(null);
  // Owned in-flight lock: a hydration run may release only the lock it itself
  // acquired, and a new submission invalidates any older run's lock (Astra
  // hydration regression: stale cleanup must never leave the account locked).
  const flightAnchor: FlightAnchor = useMemo(() => createFlightAnchor(), []);
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
          receiptRef.current = null;
          receiptAccountRef.current = null;
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
          if (receiptRef.current && receiptRef.current.txHash.toLowerCase() !== write.receipt.txHash.toLowerCase()) {
            return;
          }
          receiptRef.current = write.receipt;
          receiptAccountRef.current = write.account;
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
    const startedOp = operationId.current;
    const canApply = () =>
      mounted.current &&
      snapshot === generation.current &&
      startedOp === operationId.current &&
      !busy.current &&
      !IN_FLIGHT_STATUSES.includes(statusRef.current);

    await runHydration({
      canApply,
      getOperationId: () => operationId.current,
      flightAnchor: () => flightAnchor,
      liveReceipt: () => receiptRef.current,
      contextKey: hydrationContextKey,
      isHydratedFor: (key) => hydratedFor.current === key,
      markHydrated: (key) => {
        if (snapshot === generation.current && startedOp === operationId.current) hydratedFor.current = key;
      },
      clearHydrated: () => {
        if (snapshot === generation.current && startedOp === operationId.current) hydratedFor.current = null;
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
    async (args: {
      txHash: string;
      maciAddress: string;
      pollId: bigint;
      account: string;
      generation: number;
      operationId: number;
    }) => {
      const stillThisReceipt = () =>
        mounted.current &&
        args.generation === generation.current &&
        args.operationId === operationId.current &&
        receiptRef.current?.txHash.toLowerCase() === args.txHash.toLowerCase() &&
        receiptAccountRef.current?.toLowerCase() === args.account.toLowerCase();

      const wallet = window.ethereum;
      if (!wallet || !stillThisReceipt()) return;
      try {
        const result = await checkReceiptStatus({
          provider: asReceiptProvider(wallet),
          txHash: args.txHash,
          maciAddress: args.maciAddress,
          pollId: args.pollId,
          account: args.account,
        });
        if (stillThisReceipt()) setReceiptStatus(result.status);
      } catch {
        if (stillThisReceipt()) setReceiptStatus("unavailable");
      }
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    const wallet = window.ethereum;
    const reset = () => {
      generation.current += 1;
      operationId.current += 1;
      hydratedFor.current = null;
      invalidateFlight(flightAnchor);
      receiptRef.current = null;
      receiptAccountRef.current = null;
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
        applySubmittedReceipt(
          () => receiptStore.save(context, value),
          () => {
            if (!mounted.current || activeGeneration.current !== generation.current) return;
            receiptRef.current = value;
            receiptAccountRef.current = context.account;
            setReceipt(value);
            setReceiptAccount(context.account);
            setReceiptStatus("unverified");
            void verifyDisplayedReceipt({
              txHash: value.txHash,
              maciAddress: context.maciAddress,
              pollId: context.pollId,
              account: context.account,
              generation: activeGeneration.current,
              operationId: operationId.current,
            });
          },
        );
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
      operationId.current += 1;
      // Invalidate any in-flight hydration lock: it was acquired for the
      // PREVIOUS operation and can never be released by that run now (its
      // captured operation id is stale). Without this, the account stays
      // "in flight" and later hydrations skip it until a wallet event.
      invalidateFlight(flightAnchor);
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
    const op = operationId.current;
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
        operationId: op,
      });
    } catch {
      if (
        mounted.current &&
        snapshot === generation.current &&
        op === operationId.current &&
        receiptRef.current?.txHash.toLowerCase() === stored.txHash.toLowerCase()
      ) {
        setReceiptStatus("unavailable");
      }
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
