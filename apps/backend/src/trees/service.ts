import { JsonRpcProvider, getAddress } from "ethers";
import type { LeanIMT, LeanIMTMerkleProof } from "@zk-kit/lean-imt";

import {
  SnapshotError,
  assertNoIndexingError,
  canAppendLeaves,
  collectPages,
  findLeafIndex,
  historicalRootMatches,
  lastLeafMatches,
  leafFingerprint,
  shouldRebuildCache,
  type LeafRow,
  type Provenance,
  type SnapshotMeta,
} from "./snapshot";
import { fetchLeafPage, fetchMeta, fetchPollStats } from "./graph";
import { appendSignupLeaves, buildSignUpTree, generateSignupInclusionProof, snapshotStateRootIndex } from "./leanTree";

const MACI_ROOT_ABI = ["function getStateRootOnIndexedSignUp(uint256) view returns (uint256)"];
const DEFAULT_REFRESH_MS = 30_000;

export interface TreeConfig {
  graphUrl: string;
  maciAddress: string;
  publicRpcUrl: string;
  timeoutMs: number;
  pageSize: number;
}

interface CachedSnapshot {
  leaves: LeafRow[];
  tree: LeanIMT;
  meta: SnapshotMeta;
  stateRootIndex: number;
}

interface TreeHooks {
  fetchMeta?: typeof fetchMeta;
  fetchLeafPage?: typeof fetchLeafPage;
  onChainRoot?: (rpcUrl: string, maciAddress: string, index: number) => Promise<bigint>;
}

let cache: CachedSnapshot | null = null;
let loading: Promise<CachedSnapshot> | null = null;
let hooks: TreeHooks = {};
let backgroundTimer: ReturnType<typeof setInterval> | null = null;
let epoch = 0;

function metaFn(): typeof fetchMeta {
  return hooks.fetchMeta ?? fetchMeta;
}

function leafPageFn(): typeof fetchLeafPage {
  return hooks.fetchLeafPage ?? fetchLeafPage;
}

function configFromEnv(env: NodeJS.ProcessEnv = process.env): TreeConfig | null {
  const graphUrl = env.GRAPH_URL || env.MACI_GRAPH_URL;
  const maciAddress = env.MACI_ADDRESS;
  const publicRpcUrl = env.PUBLIC_RPC_URL;
  if (!graphUrl || !maciAddress || !publicRpcUrl) return null;
  return {
    graphUrl,
    maciAddress: getAddress(maciAddress),
    publicRpcUrl,
    timeoutMs: Number(env.GRAPH_TIMEOUT_MS || 8000),
    pageSize: Number(env.GRAPH_PAGE_SIZE || 1000),
  };
}

async function defaultOnChainRoot(rpcUrl: string, maciAddress: string, index: number): Promise<bigint> {
  const { Contract } = await import("ethers");
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const maci = new Contract(maciAddress, MACI_ROOT_ABI, provider);
    const root = await maci.getStateRootOnIndexedSignUp(index);
    return BigInt(root.toString());
  } finally {
    provider.destroy();
  }
}

async function readOnChainRoot(cfg: TreeConfig, index: number): Promise<bigint> {
  const fn = hooks.onChainRoot ?? defaultOnChainRoot;
  return fn(cfg.publicRpcUrl, cfg.maciAddress, index);
}

async function fetchLeavesAt(cfg: TreeConfig, provenance: Provenance, startCursor: bigint): Promise<LeafRow[]> {
  const fetchPage = leafPageFn();
  return collectPages({
    pageSize: cfg.pageSize,
    startCursor,
    startExpectedIndex: startCursor === 0n ? 1n : startCursor + 1n,
    fetchPage: async (cursor, pageSize) => {
      const page = await fetchPage(cfg.graphUrl, cfg.timeoutMs, {
        maci: cfg.maciAddress.toLowerCase(),
        first: pageSize,
        cursor: cursor.toString(),
        block: provenance.blockNumber,
      });
      assertNoIndexingError(page._meta);
      return page.stateLeaves;
    },
  });
}

async function verifyCachedPrefix(cfg: TreeConfig, previous: CachedSnapshot, provenance: Provenance): Promise<void> {
  if (previous.leaves.length === 0) return;
  const last = previous.leaves[previous.leaves.length - 1];
  const cursor = BigInt(last.stateIndex) - 1n;
  const page = await leafPageFn()(cfg.graphUrl, cfg.timeoutMs, {
    maci: cfg.maciAddress.toLowerCase(),
    first: 1,
    cursor: cursor.toString(),
    block: provenance.blockNumber,
  });
  assertNoIndexingError(page._meta);
  if (!lastLeafMatches(previous.leaves, page.stateLeaves[0])) {
    throw new SnapshotError("Cached signup prefix does not match the new indexed block.", "PREFIX_CHANGED");
  }
}

async function publishSnapshot(
  leaves: LeafRow[],
  tree: LeanIMT,
  provenance: Provenance,
  cfg: TreeConfig,
): Promise<CachedSnapshot> {
  const stateRootIndex = snapshotStateRootIndex(tree);
  const expected = await readOnChainRoot(cfg, stateRootIndex);
  if (!historicalRootMatches(tree.root, expected)) {
    throw new SnapshotError("Indexed LeanIMT root does not match getStateRootOnIndexedSignUp.", "ROOT_MISMATCH");
  }
  return {
    leaves,
    tree,
    stateRootIndex,
    meta: { provenance, leafFingerprint: leafFingerprint(leaves) },
  };
}

async function incrementalAppend(
  cfg: TreeConfig,
  previous: CachedSnapshot,
  provenance: Provenance,
): Promise<CachedSnapshot> {
  await verifyCachedPrefix(cfg, previous, provenance);
  const startCursor =
    previous.leaves.length === 0 ? 0n : BigInt(previous.leaves[previous.leaves.length - 1].stateIndex);
  const extra = await fetchLeavesAt(cfg, provenance, startCursor);
  if (!canAppendLeaves(previous.leaves, extra)) {
    throw new SnapshotError("New signup leaves are not a contiguous append.", "PAGINATION_GAP");
  }
  if (extra.length === 0) {
    return publishSnapshot(previous.leaves, previous.tree, provenance, cfg);
  }
  // Clone + insertMany on the copy only. publishSnapshot checks the new root
  // before refreshSnapshot swaps cache, so in-flight proofs keep the old tree.
  const nextTree = await appendSignupLeaves(previous.tree, extra);
  return publishSnapshot(previous.leaves.concat(extra), nextTree, provenance, cfg);
}

async function fullLoad(cfg: TreeConfig, provenance: Provenance): Promise<CachedSnapshot> {
  const leaves = await fetchLeavesAt(cfg, provenance, 0n);
  return publishSnapshot(leaves, buildSignUpTree(leaves), provenance, cfg);
}

async function loadSnapshot(cfg: TreeConfig): Promise<CachedSnapshot> {
  const head = await metaFn()(cfg.graphUrl, cfg.timeoutMs);
  assertNoIndexingError(head);
  if (!head.block?.hash) {
    throw new SnapshotError("Subgraph _meta.block.hash missing.", "PROVENANCE");
  }
  const provenance: Provenance = { blockNumber: head.block.number, blockHash: head.block.hash };
  const previous = cache;
  const sameHeightReorg =
    !!previous &&
    previous.meta.provenance.blockNumber === provenance.blockNumber &&
    previous.meta.provenance.blockHash !== provenance.blockHash;
  if (previous && !sameHeightReorg && previous.meta.provenance.blockNumber < provenance.blockNumber) {
    try {
      return await incrementalAppend(cfg, previous, provenance);
    } catch {
      // Prefix changed or root mismatch — download the full snapshot.
    }
  }
  return fullLoad(cfg, provenance);
}

async function retainIfHistoricallyValid(snapshot: CachedSnapshot, cfg: TreeConfig): Promise<CachedSnapshot | null> {
  try {
    const expected = await readOnChainRoot(cfg, snapshot.stateRootIndex);
    if (historicalRootMatches(snapshot.tree.root, expected)) return snapshot;
  } catch {
    // Cannot confirm the historical root — do not serve a possibly orphaned path.
  }
  return null;
}

export function setTreeTestHooks(next: TreeHooks): void {
  hooks = next;
}

export function resetTreeService(): void {
  epoch += 1;
  cache = null;
  loading = null;
  hooks = {};
  stopBackgroundRefresh();
}

export function stopBackgroundRefresh(): void {
  if (backgroundTimer) {
    clearInterval(backgroundTimer);
    backgroundTimer = null;
  }
}

export function startBackgroundRefresh(env: NodeJS.ProcessEnv = process.env, intervalMs = DEFAULT_REFRESH_MS): void {
  stopBackgroundRefresh();
  void refreshSnapshot(env).catch(() => {
    // Indexer optional at boot; join falls back to RPC.
  });
  backgroundTimer = setInterval(() => {
    void refreshSnapshot(env).catch(() => {
      /* keep serving a historically valid cache, if any */
    });
  }, intervalMs);
  backgroundTimer.unref?.();
}

export async function refreshSnapshot(env: NodeJS.ProcessEnv = process.env): Promise<CachedSnapshot | null> {
  const cfg = configFromEnv(env);
  if (!cfg) return null;
  if (loading) return loading;
  const started = epoch;
  loading = (async () => {
    try {
      const next = await loadSnapshot(cfg);
      if (started !== epoch) return next;
      cache = next;
      return cache;
    } catch (error) {
      if (started !== epoch) return cache as CachedSnapshot;
      const retained = cache ? await retainIfHistoricallyValid(cache, cfg) : null;
      if (retained) {
        cache = retained;
        return retained;
      }
      cache = null;
      throw error;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Serve a validated snapshot. Do not wait for a full rebuild on an ordinary click. */
export async function getInclusionProof(args: {
  maci: string;
  publicKeyX: string;
  publicKeyY: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  leafIndex: number;
  stateRootIndex: number;
  inclusionProof: LeanIMTMerkleProof;
  provenance: Provenance;
}> {
  const env = args.env || process.env;
  const cfg = configFromEnv(env);
  if (!cfg) {
    throw new SnapshotError("GRAPH_URL / MACI_ADDRESS / PUBLIC_RPC_URL are not configured.", "NOT_CONFIGURED");
  }
  if (getAddress(args.maci) !== cfg.maciAddress) {
    throw new SnapshotError("MACI address is not the configured deployment.", "MACI_MISMATCH");
  }

  let snapshot = cache;
  if (!snapshot) {
    snapshot = await refreshSnapshot(env);
  } else {
    let stale = true;
    try {
      const head = await metaFn()(cfg.graphUrl, cfg.timeoutMs);
      stale = shouldRebuildCache(snapshot.meta, {
        blockNumber: head.block.number,
        blockHash: head.block.hash,
        hasIndexingErrors: head.hasIndexingErrors,
      });
    } catch {
      stale = true;
    }
    if (stale) {
      const pending = refreshSnapshot(env);
      void pending.catch(() => {
        /* background only when we can still serve a historical snapshot */
      });
      const usable = await retainIfHistoricallyValid(snapshot, cfg);
      if (usable) {
        snapshot = usable;
      } else {
        snapshot = await pending;
      }
    }
  }

  if (!snapshot) {
    throw new SnapshotError("Signup tree snapshot is unavailable.", "NO_SNAPSHOT");
  }

  try {
    return proofFromSnapshot(snapshot, args);
  } catch (error) {
    if (error instanceof SnapshotError && error.code === "VOTER_NOT_IN_SNAPSHOT") {
      const next = await refreshSnapshot(env);
      if (!next) throw error;
      return proofFromSnapshot(next, args);
    }
    throw error;
  }
}

function proofFromSnapshot(
  snapshot: CachedSnapshot,
  args: { publicKeyX: string; publicKeyY: string },
): {
  leafIndex: number;
  stateRootIndex: number;
  inclusionProof: LeanIMTMerkleProof;
  provenance: Provenance;
} {
  const leafIndex = findLeafIndex(snapshot.leaves, args.publicKeyX, args.publicKeyY);
  const inclusionProof = generateSignupInclusionProof(snapshot.tree, leafIndex);
  return {
    leafIndex,
    stateRootIndex: snapshot.stateRootIndex,
    inclusionProof,
    provenance: snapshot.meta.provenance,
  };
}

export async function getJoinedParticipantStats(env: NodeJS.ProcessEnv = process.env): Promise<{
  joinedParticipants: string;
  indexedBlock: number;
  indexedBlockHash: string;
  hasIndexingError: boolean;
} | null> {
  const cfg = configFromEnv(env);
  const pollId = env.POLL_ID;
  const pollAddress = env.POLL_ADDRESS;
  if (!cfg || pollId === undefined) return null;
  const head = await metaFn()(cfg.graphUrl, cfg.timeoutMs);
  const id = pollAddress ? pollAddress.toLowerCase() : undefined;
  if (!id) {
    return {
      joinedParticipants: "unavailable",
      indexedBlock: head.block.number,
      indexedBlockHash: head.block.hash,
      hasIndexingError: !!head.hasIndexingErrors,
    };
  }
  const page = await fetchPollStats(cfg.graphUrl, cfg.timeoutMs, { id, block: head.block.number });
  return {
    joinedParticipants: page.poll?.registrationCount ?? "0",
    indexedBlock: page._meta.block.number,
    indexedBlockHash: page._meta.block.hash,
    hasIndexingError: !!page._meta.hasIndexingErrors,
  };
}

export function serializeProof(proof: LeanIMTMerkleProof): {
  root: string;
  leaf: string;
  index: number;
  siblings: string[];
} {
  return {
    root: proof.root.toString(),
    leaf: proof.leaf.toString(),
    index: proof.index,
    siblings: proof.siblings.map((s) => s.toString()),
  };
}

export { SnapshotError } from "./snapshot";
