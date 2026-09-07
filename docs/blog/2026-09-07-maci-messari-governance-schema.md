# How MACI, The Graph, and a Messari Standardized Subgraph Fit Together

_September 2026 — VenekoVox S5 build note_

This post explains three things that caused confusion during our hackathon build:

1. What MACI actually stores on-chain vs. what stays private
2. What a subgraph should index for a private-voting protocol
3. Why we're extending Messari's governance schema — and why "Governor" was the wrong name for it

---

## 1. MACI's architecture: what's public, what's private

MACI (Minimal Anti-Collusion Infrastructure) is a voting system designed so that
voters can prove they are eligible human beings, but no one — not even the vote
coordinator — can see how any individual voted until the tally is published.

It has three conceptual layers:

**Encrypted votes.** Each voter signs a message, then encrypts their vote with the
coordinator's public key. The ciphertext goes on-chain. Only the coordinator can
decrypt it.

**Merkle/state tree.** When voters sign up, their public keys become leaves in a
tree. When they vote, the tree updates. The tree root is the public commitment —
everyone can verify the tree exists and has a certain depth, but nothing about
individual leaves is readable.

**Tally.** After voting ends, the coordinator publishes a decryption key and a
proof. Anyone can verify the tally is correct without ever seeing individual votes.

What's _public_ on-chain: `DeployPoll`, `PollJoined`, `PublishMessage`,
`ChainHashUpdated`, `IpfsHashAdded`.

What's _private_: the actual votes and the final tally until the coordinator
publishes.

---

## 2. What the subgraph should store

A subgraph turns on-chain events into a queryable GraphQL API. For MACI, the
question is: what can we show without breaking privacy?

The answer is **poll metadata and aggregate counters**, not individual votes.

Our v2 schema stores:

| Entity                      | What it represents                               | What it contains                                                           |
| --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| `GovernanceFramework`       | The MACI contract instance                       | Address, network, schema version                                           |
| `Proposal`                  | A poll, projected into standard governance shape | Time window, options, privacy flags, publication/registration/batch counts |
| `Poll`                      | MACI's native poll                               | Start/end dates, vote options, mode, tally address                         |
| `Registration`              | One `PollJoined` event                           | Unique per poll + voter — a count, not an identity                         |
| `ChainHash`                 | `ChainHashUpdated` event                         | Off-chain batch anchor                                                     |
| `MACI` / `User` / `Account` | Upstream native entities                         | Unchanged from original                                                    |

What we _deliberately do not_ store:

- Individual votes (ciphertext stays in the native `Vote` entity, never attributed)
- Tally results (`tallyStatus = "UNAVAILABLE"` until S4.1 lands verified ingestion)
- Voter identities or token balances
- Fabricated participation metrics

The native `Vote` entity is ciphertext. We never create a public `Vote` or
`Delegate` record from it.

---

## 3. The Messari governance schema — and why "Governor" was a misnomer

Messari maintains a set of standardized subgraph schemas for major DeFi
categories: DEX, lending, governance, etc. These let dashboards and agents query
different protocols with the same GraphQL shape.

The governance schema is modeled after OpenZeppelin Governor — the framework used
by Compound, Uniswap, Aave, and hundreds of DAOs. It assumes **public voting**:
you can see who voted, how much weight they had, and which way the tally went.

MACI doesn't fit that model. It has no delegates, no token-weighted votes, no
public tally — because its entire design point is privacy.

**The gap:** Messari's governance schema has no field for "this protocol uses
encrypted ballots and the tally is currently unavailable." A subgraph that
extends it for MACI either has to silently omit that dimension (lying by
omission) or fabricate public tallies (worse).

**What we did:** we extended the schema with a `Proposal` projection that keeps
the common fields — `startTime`, `endTime`, `voteOptionCapacity`, `votingMode` —
and adds explicit privacy fields:

```graphql
ballotPrivacy:      "ENCRYPTED"
coordinatorTrust:   "COORDINATOR_CAN_DECRYPT"
tallyStatus:        "UNAVAILABLE"
```

No votes are fabricated. No delegates are invented. The schema says plainly: this
is a governance proposal, here is its public metadata, and here is why you cannot
see the result yet.

The internal filename `messari-openzeppelin-governor.graphql` caused confusion —
it's just the Messari governance schema reference file, not an integration with
the OpenZeppelin Governor protocol. We should rename it to
`messari-governance-reference.graphql` to avoid that implication.

---

## 4. What the comparative query actually proves

S5.2 asks for a "meaningful live comparative query with a reference Governor
source." That sounds like we're comparing MACI to Governor. We're not.

We're proving **schema composability**: given a governance proposal in either
system, the fields both systems agree on are queryable in the same shape.

```
MACI data model                    Messari governance schema
─────────────────                  ────────────────────────
Poll start/end dates    →          Proposal.startTime      ✓ aligns
Poll voteOptions        →          Proposal.voteOptionCount ✓ aligns
Poll mode               →          Proposal.votingMode      ✓ aligns
Poll registrationCount  →          Proposal.registrationCount ✓ aligns

MACI encrypted votes    →          no match — this is the
MACI tally (private)    →          gap our extension documents
```

The `client/compare.mjs` script runs the same query against our subgraph and a
live Governor subgraph and reports where the schemas align and where they diverge.
That's the evidence for "yes, these schemas are composable, and here is the
privacy dimension that only MACI has."

---

## 5. Why this matters for the prize

The Graph's "Best Use of Composable or Standardized Graph Products" prize
criteria say:

> "Authoring or extending a Standardized Subgraph, or contributing a reusable
> composable Substreams module, is in scope."

Simply querying one subgraph doesn't qualify. Our submission does two things:

1. **Extends** the Messari governance schema with a privacy dimension that
   currently doesn't exist — ballot privacy as a first-class field.
2. **Demonstrates composability** with a live cross-protocol query against a
   reference Governor subgraph.

The upstream contribution to `messari/subgraphs` is a future step. Right now we
have a locally tested extension with live deployment evidence pending.

---

## Summary

- MACI is private-by-design: votes encrypted, tally delayed, coordinator trust is explicit.
- The subgraph indexes only what can be public: proposal metadata, registration counts, publication/batch counters.
- We're not forcing MACI into a Governor shape. We're saying "the proposal metadata MACI already has maps to Messari's `Proposal` — here are the fields, and here's a privacy extension because MACI's votes are encrypted."
- The comparative query proves schema composability, not protocol equivalence.
- This is a contribution to Messari's governance schema family — not an OpenZeppelin Governor integration.

---

_Built at ETHGlobal Online 2026. Subgraph deployed to The Graph Studio:
`venekovox-governance-v-2` on Sepolia, startBlock 11567000._
