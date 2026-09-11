/** Fetch a pinned inclusion proof from the backend. Bounded timeout; caller falls back. */

const DEFAULT_TIMEOUT_MS = 8000;

export interface JsonInclusionProof {
  root: string;
  leaf: string;
  index: number;
  siblings: string[];
}

export interface JoinWitness {
  inclusionProof: {
    root: bigint;
    leaf: bigint;
    index: number;
    siblings: bigint[];
  };
  stateRootIndex: number;
  leafIndex: number;
}

export async function fetchJoinWitness({
  backendUrl,
  maci,
  publicKeyX,
  publicKeyY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  backendUrl: string;
  maci: string;
  publicKeyX: string;
  publicKeyY: string;
  timeoutMs?: number;
}): Promise<JoinWitness | null> {
  const url = new URL("/trees/inclusion-proof", backendUrl.replace(/\/$/, ""));
  url.searchParams.set("maci", maci);
  url.searchParams.set("publicKeyX", publicKeyX);
  url.searchParams.set("publicKeyY", publicKeyY);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      leafIndex: number;
      stateRootIndex: number;
      inclusionProof: JsonInclusionProof;
    };
    if (body.stateRootIndex === undefined || !body.inclusionProof) return null;
    return {
      leafIndex: body.leafIndex,
      stateRootIndex: Number(body.stateRootIndex),
      inclusionProof: {
        root: BigInt(body.inclusionProof.root),
        leaf: BigInt(body.inclusionProof.leaf),
        index: body.inclusionProof.index,
        siblings: body.inclusionProof.siblings.map((s) => BigInt(s)),
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJoinedParticipants({
  backendUrl,
  pollAddress,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  backendUrl: string;
  pollAddress?: string;
  timeoutMs?: number;
}): Promise<{
  joinedParticipants: string;
  indexedBlock: number;
  indexedBlockHash: string;
  hasIndexingError: boolean;
} | null> {
  const url = new URL("/trees/joined-count", backendUrl.replace(/\/$/, ""));
  if (pollAddress) url.searchParams.set("poll", pollAddress);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as {
      joinedParticipants: string;
      indexedBlock: number;
      indexedBlockHash: string;
      hasIndexingError: boolean;
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
