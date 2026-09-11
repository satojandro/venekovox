# 2,300 RPC calls per voter: what MACI's join actually costs

_September 2026 — VenekoVox build note. The scaling wall we hit in production, what we
did about it, and what we deliberately did not claim._

> This post is a journal entry, not a protocol critique. We forked MACI, hit a wall, and
> had to understand the wall well enough to work around it honestly. What follows is the
> mechanism, the arithmetic, our approach, our measurements, and the limits of all three.

---

## 1. The question nobody asks until it hurts

To _join_ a MACI poll, a voter's browser must produce a zero-knowledge proof. That proof
says: _"I know a private key whose public key is a leaf in this poll's state tree, at
index N, and here is the Merkle path proving it."_

The circuit needs a **Merkle inclusion path** against the poll's state tree. Which means
the client has to know the tree.

MACI does not store a Merkle path per user on-chain. It stores the **root**
(`stateRootsOnIndexedSignUp`) and emits a `SignUp` event per registration. So the client
can only reconstruct the path one way: **rebuild the tree from the events.**

That is the hidden bill.

---

## 2. The arithmetic

The SDK's path is `joinPoll` → `generateMaciStateTree` → `generateSignUpTree`, which scans
events in batches. From the source:

```ts
// packages/sdk/ts/user/utils.ts
blocksPerRequest: blocksPerBatch || 50,
```

And the scan's starting point is worth sitting with:

```ts
export const getFirstSignUpBlockNumber = async (maciContract, startBlock?) => {
  if (startBlock) return startBlock; // ← the caller's value, not the first signup
  return maciContract.queryFilter(maciContract.filters.SignUp(), 0).then((events) => events[0]?.blockNumber ?? 0); // ← otherwise: from block 0
};
```

So if you pass a `startBlock` — as any sane integration does — the scan begins **there**,
not at the first registration. And if you don't pass one, it queries `SignUp` logs **from
block 0**.

On our own deployment:

|                                                             |                                |
| ----------------------------------------------------------- | ------------------------------ |
| Scan start (`VITE_MACI_START_BLOCK` = the deployment block) | `11567000`                     |
| Where the only actual `SignUp` sits                         | ~`11680xxx` (Sep 10)           |
| Head at time of writing                                     | `11683180`                     |
| **Blocks scanned**                                          | **~116,180**                   |
| **At the SDK's default 50-block batches**                   | **~2,300 `eth_getLogs` calls** |
| At 1,000-block batches                                      | ~116 calls                     |

Two things fall out of this that matter more than the headline:

**The RPC cost is O(blocks since `startBlock`), not O(voters).** It grows with _time_, not
with participation. A poll that nobody has registered for still costs a full scan. Our
single real registration sat above ~115,000 blocks of empty history, and every voter still
walks all of it.

**The client-side cost is a separate O(voters).** Building the LeanIMT from the returned
events is linear in leaf count and lands on the voter's device. So there are two walls, and
they scale along different axes:

```
RPC calls   ≈  (head − startBlock) / blocksPerRequest        ← grows with time
tree work   ≈  number of registrations                       ← grows with participation
```

Fixing one does not fix the other. More on that in §4.

**~2,300 sequential RPC calls, per voter, per join attempt** — to reconstruct a tree whose
_root_ the contract already knows.

---

## 3. What it looked like in production

This was not a theoretical concern. In one live session our first real voter produced:

- `-32005 Rate Limit Exceeded` mid-scan on a wallet RPC
- nodes returning **empty revert data** (ethers reporting a `CALL_EXCEPTION` for a call that
  was never made)
- a node enforcing a **50-block `eth_getLogs` cap**
- load-balanced public replicas transiently reverting `getPoll`

We shipped six infrastructure fixes to survive that (multi-provider fallback, retries with
backoff, capped grant windows, narrowed join retries). They worked. **They were band-aids.**
Retries make an O(N)-per-voter scan demo-survivable; they cannot make it a product.

---

## 4. Two problems that look like one

Our first framing was wrong, and correcting it mattered:

|       | Problem                                                                                         | What actually fixes it                  |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------------------------- |
| **A** | **Event retrieval.** Fetching `SignUp` events without thousands of fragile `eth_getLogs` calls. | An indexer (subgraph).                  |
| **B** | **Inclusion-proof supply.** Producing a Merkle path _against the current tree_.                 | The tree itself has to exist somewhere. |

An indexer solves A completely. It does **not** solve B — the client still has to build the
LeanIMT from those events and derive the path. That work is linear in the number of
registrations, and it lands on the voter's device: at 100k+ registrations it is O(n) memory
and CPU, per voter, per session. A 1-query indexer removes the RPC wall and leaves this one
exactly as it was.

If you conflate A and B you will "fix" the RPC wall and ship a product that still stalls on
the client. We nearly did.

---

## 5. Our approach

**Two pieces, deliberately separable.**

### 5.1 Index the leaves (solves A)

A subgraph mapping on MACI's `SignUp` event writes an **immutable** `StateLeaf` entity:

```ts
// apps/subgraph/src/maci.ts
export function handleSignUp(event: SignUpEvent): void {
  createStateLeaf(
    event,
    event.params._stateIndex,
    event.params._userPublicKeyX,
    event.params._userPublicKeyY,
    event.params._timestamp,
  );
  // …
}
```

That turns ~2,300 `eth_getLogs` calls into **one paginated GraphQL query**, ordered by
`stateIndex`. Nothing is derived or inferred — the entity is the event parameters, stored
verbatim and immutable.

### 5.2 Keep the tree incrementally, serve the path (solves B)

A thin backend service maintains the LeanIMT and answers one question:

```
GET /trees/inclusion-proof?maci=0x…&publicKeyX=…&publicKeyY=…
→ { leafIndex, stateRootIndex, inclusionProof: { root, leaf, index, siblings }, provenance }
```

From ~2,300 RPC calls to **one HTTP call**, and the client never builds a tree at all.

---

## 6. The trust question — the part that made this acceptable

A tree service sounds like exactly the centralisation you adopt MACI to avoid: _who do you
trust to hand you a Merkle path?_

**You don't trust it. You check it.** The client validates the returned path against the
**contract's own root**:

```ts
// packages/sdk/ts/user/joinWitness.ts
const expectedRoot = await maciContract.getStateRootOnIndexedSignUp(stateRootIndex);
```

`getStateRootOnIndexedSignUp(N)` is public on-chain state. The client re-hashes the returned
siblings locally (log n hashes, milliseconds) and requires the result to equal that root.

The consequences:

- A service that lies produces a path with the wrong root → **the check fails** → the client
  falls back to building locally from the subgraph leaves, then to the original RPC path.
- The service is a **precomputation cache, not an authority**. It can withhold (an
  availability problem, mitigated by fallbacks); it cannot forge.
- The private key never leaves the browser. The proof is still generated client-side.

This is the design decision we are most comfortable with, and it is worth stating plainly:
**the scalability fix costs a centralisation point in _availability_ and zero in _trust_.**

---

## 7. Journal: the details that actually bit us

This is the part other implementers might find useful.

**The PAD leaf.** MACI's tree has a padding leaf at index 0, so `stateRootIndex` is
`tree.size - 1`, not `tree.size`. Get this off by one and every proof fails validation
against a root that looks plausible.

**Never rebuild the live tree.** A cold rebuild replaces the whole structure, so a proof
request arriving mid-rebuild can see a half-built tree. The design rule the code enforces is
that a full rebuild is for first load and reorgs only, and every incremental update clones
and swaps instead:

```ts
// apps/backend/src/trees/leanTree.ts
const next = LeanIMT.import(hashLeanIMT, tree.export()); // clone, no hash recompute
next.insertMany(hashes.slice(offset, offset + chunk)); // only the NEW leaves
```

...inserting in chunks of 64 with a `setImmediate` yield between them so proof requests can
still be served, and swapping the published cache **only after the new root is verified**.
The previous snapshot stays readable for the whole duration of the swap.

**Same-height reorgs are not "no change".** Comparing leaf _counts_ misses a reorg that
replaces a leaf without changing the length. Compare a fingerprint of the leaf set:

```ts
export function sameSizeReorg(previous, next, nextSize, previousSize): boolean {
  return previousSize === nextSize && previous.leafFingerprint !== next.leafFingerprint;
}
```

**A lagging snapshot is only servable while it is still historically true.** If the cache is
behind head, serving it is fine — _provided_ the on-chain root at its `stateRootIndex` still
matches:

```ts
export function historicalRootMatches(treeRoot: bigint, onChainRoot: bigint): boolean {
  return treeRoot === onChainRoot;
}
```

Otherwise the client would validate against a root the contract no longer agrees with.

**Assume the indexer can lie by omission.** `assertContiguousSignupIndexes` fails loudly on a
gap in `stateIndex` sequence rather than silently building a shorter tree from a paginated
query that dropped a page. A missing leaf in the middle changes the root; a missing leaf at
the end just looks like an older snapshot. Both must be caught.

**Pin the index, or a concurrent signup invalidates the proof.** If another voter signs up
between proof preparation and submission, a freshly-derived path can point at a root that no
longer holds. The client pins `stateRootIndex` and validates against the historical root —
and the join still submits once.

**Everything gets a bounded timeout and a fallback**, because a free hosted service will be
down eventually:

```
service proof  →  subgraph stateLeaves (client builds)  →  RPC scan
```

---

## 8. What we measured

We refused to claim "it scales" without checking it against the chain.

**The parity gate** (local graph-node, real Sepolia logs, deployed from block 11567000):

| Check                                                                    | Result                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Indexed `StateLeaf` rows vs an independent RPC rebuild at the same block | **row-for-row identical** (`stateIndex`, X, Y, timestamp)            |
| Indexed tree root rebuilt locally                                        | `0x160818aa7af04782c6e28e4bd73abe17cfdc5485433d77b3e5d6a9c652f9f450` |
| **On-chain** `getStateRootOnIndexedSignUp(1)` at that block              | `0x160818aa…f450` — **equal**                                        |
| `_meta.hasIndexingErrors`                                                | `false`                                                              |

The second column is the point: the indexer's leaves rebuild **the exact root the contract
pins**, at the same block. That is the gate that makes the whole approach more than
plumbing.

Then the same build was deployed to Subgraph Studio, synced to head, and verified publicly —
one call, no API key:

```
stateLeaves(first:3) → the real registration
_meta.block.number   → equal to the chain head
```

---

## 9. What we did not do, and will not claim

- **We did not make MACI scale to a million users.** We removed the _per-voter RPC wall_. The
  leaf set still has to reach the client, proof generation is still CPU-local and slow, and
  O(n) transfer remains at the extreme. Those are the next frontier and they are not solved
  here.
- **We did not touch the contracts or the circuits.** No protocol change. The extension lives
  entirely on the read/index side.
- **We did not survey the community.** The "it doesn't scale past ten thousand users" framing
  is our own arithmetic on our own deployment (§2). Others may run different batch sizes,
  paid RPCs, or a coordinator-side tree. We can only state what we measured.
- **This is not upstreamed yet.** It is a fork-side extension in the Continuity lane. If the
  pattern is useful, the honest next step is a proposal, not a blog post.
- **The subgraph is still a hosted dependency.** Studio's free tier is real infrastructure
  with real limits. We keep the RPC path as a fallback precisely so nothing hard-depends on
  it.

---

## 10. So how is this different from forking MACI?

Because a hackathon judge asks exactly this, and it deserves a straight answer. Forking
gives you a protocol that works. It does not give you a product. The distance between the
two is where the work is:

| Capability                                 | In the standard repo       | Here                                                                                                             |
| ------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Join without rebuilding the tree per voter | ✗                          | ✅ **indexed leaves + served inclusion proof, validated against the on-chain root**                              |
| Eligibility                                | ACLs / allowlists          | ✅ **ZKPassport proof** — salted uniqueness + strict FaceMatch, verified server-side, minted as an EIP-712 grant |
| Reading protocol state                     | RPC calls                  | ✅ **an authored subgraph** with a standardized-schema extension, publicly queryable                             |
| "Did my vote land?"                        | —                          | ✅ **on-chain receipt verification** with distinct states, resolving the poll address itself                     |
| Who the account is                         | a hex address              | 🚧 **ENS names** resolved at display time, without touching the private vote path — _in progress_                |
| Gas                                        | the voter needs ETH        | 🚧 **sponsored execution** (Privy / EIP-7702) so a zero-balance voter can vote — _researched, not shipped_       |
| Results                                    | coordinator runs the tally | 🚧 **proof-verified results surface** — _not built_                                                              |

✅ = shipped and evidenced in this repo. 🚧 = designed, scoped, and in progress — listed because
the question is "how is this different", and pretending the roadmap is the product is the
fastest way to lose a reader's trust. We would rather show the boundary.

Each of those is a place where the repo's defaults meet a real user and stop. That is the
productisation work, and it is also why we now understand the protocol rather than just
hosting it.

---

## 11. Takeaways

1. **Ask what the proof needs, not what the function does.** `joinPoll` reads like an API
   call; it is a tree rebuild over the entire poll history.
2. **Do the arithmetic on your own deployment before you optimise.** 115,800 blocks ÷ 50 =
   ~2,300 calls. Numbers end arguments.
3. **Separate retrieval from proof supply.** Fixing the RPC wall does not fix the client.
4. **Don't ask clients to trust a service — ask them to verify it.** An on-chain root check
   turns a centralisation-shaped solution into a cache.
5. **Rebuild is the enemy.** Clone, append, verify, swap. Never mutate the live structure.
6. **Measure against the chain, not against your own logs.** Our gate was "the rebuilt root
   equals the root the contract pins", not "our tests pass".
7. **State the limits in the same document as the claim.** It is the only way the useful part
   survives scrutiny.
