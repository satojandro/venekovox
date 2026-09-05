# Product journey, architecture and design rationale

**What this is:** the product journey, the system architecture, the trust
boundaries, and the reasoning behind the design.

- For **what exists in code right now**, read [journey-map.md](journey-map.md) and [status.md](status.md).
- For **what to build next**, read [roadmap.md](roadmap.md) and [build.md](build.md).

A design described here is not automatically implemented.

---

## 1. Purpose

VenekoVox gives people a recurring way to express views on public issues. Its
foundation is eligibility backed by identity proofs, private ballot submission,
and inspectable aggregate outcomes. The motivation is civic voice and trust,
informed by Alejandro's experience growing up in Venezuela.

A successful product lets a person understand what they are answering, why they
qualify, what information they disclose, and what happens after submission.
Technology and prize integrations must support this journey.

## 2. People and their jobs

| Person                | Job                                                        | Required outcome                                                                |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Participant           | Express a view without publicly publishing a ballot choice | Clear eligibility, private submission, reliable recovery and results            |
| Returning participant | Follow issues over time                                    | Recognizable profile, previous participation state and published results        |
| Poll creator          | Ask a clear, current question of a defined group           | Immutable choices, eligibility and schedule; a reachable audience               |
| Reader / researcher   | Understand what participants said                          | Provenance, methodology, sample size, finality and limitations                  |
| Operator              | Keep verification, proving and indexing functioning        | Reproducible deployment, recovery and evidence checkpoints                      |
| Agent                 | Help users discover, interpret or create polls             | Same public data and creation rules as other clients; no human-ballot authority |

## 3. The first complete journey (M1)

1. Open one real poll. Read its question, choices, eligibility, schedule and privacy explanation. Clearly distinguish demonstration content from real data.
2. Connect an account. The eventual default should avoid wallet installation and manual gas funding; an injected wallet remains a fallback.
3. Verify the required eligibility through Self Pass. Explain requested disclosures before scanning. Verification failure offers a recoverable path.
4. Authorize the actual participating account under the poll's policy. A UI success flag is insufficient.
5. Submit a choice. The application handles signup, poll membership and encrypted publish, exposes understandable progress, and prevents duplicate concurrent actions.
6. Refresh or reconnect. Recover chain-backed participation and transaction status without showing another account's state. Explain key loss separately from wallet disconnection.
7. After closing, return to proof-verified aggregate results. Show tally/indexing progress while results are unavailable.

A CLI/operator-created poll is acceptable for M1. A complete public creation flow
is a later milestone. Smart-wallet compatibility and eligibility binding must be
decided together before a final M1 policy deployment.

## 4. Experience principles

- Use ordinary language: "Verify eligibility", "Submit privately", "Submission confirmed", "Results being verified". Technical detail belongs in expandable evidence views.
- Never turn a network error into "you are not registered", an empty dataset into zero votes, or a stored hash into proof of confirmation.
- Distinguish proof verification, registration, membership, submitted messages and counted outcomes. They are different events and may have different counts.
- Preserve progress across refresh and wallet changes; do not silently generate a replacement voting identity when recovery was intended.
- Make public profile linkage explicit. ENS names are persistent pseudonyms, not an anonymity guarantee.
- Spanish and English matter to the intended audience. Verify actual translated journeys before claiming full multilingual support.
- Gas sponsorship should make the eligible path usable with zero ETH. Failures must explain how to retry without unexpected payment prompts.

---

## 5. Why the design is this way

### The problem shape

Public on-chain voting has two failure modes that push in opposite directions:

- **Open voting is buyable.** If ballots are attributable, a briber can verify compliance. On-chain attribution makes vote-buying _auditable_ — by the buyer.
- **Hidden voting is unauditable.** If nobody can see anything, the operator can invent results.

MACI's answer: **attribute nothing to anyone, but prove the aggregate.** Votes are
encrypted to a coordinator, spent with nullifiers, and the final tally ships with a
zk-proof of correct computation. Bribery becomes _verification-blind_ — a briber
cannot check how their victim voted — while anyone can verify that the published
tally is the honest decryption of the real ballots.

VenekoVox adds the missing layer on the identity side: **proof of unique humanness**
via Self.xyz passport zk-proofs, so "one person, one voice" doesn't depend on wallet
counting (wallets are free; humans aren't).

### Why the vote journey is atomic

The 2025 flow passed state through React renders and published with a stale index.
P1 replaced it with one atomic operation (`voteFlow.ts`), for these reasons:

- **One async operation, not three UI steps.** The flow captures `{chainId, maciAddress, pollId, account}` at submission start; the fresh `pollStateIndex` is passed directly into `publish`. React state is display-only.
- **Chain-first recovery.** Signup/join are _looked up_ before they are _executed_, so a refresh or a rejected tx never re-submits a transaction — membership is a fact on-chain, not app state.
- **`lookup-failed` ≠ "not registered".** A failed RPC is not knowing. UI copy and the state machine keep these apart (trust requirement, not polish).
- **Receipts record submission, not counting.** Key = chain + MACI + poll + wallet; contents = tx hash + timestamp. Counting is the tally's business. Corrupt/missing storage reads as "unable to confirm".
- **Wallet-switch safety.** A mid-flight account switch files the receipt under the _original_ wallet and the page will not display it under the new one.

### Trust boundaries (stated plainly)

- **The coordinator sees ciphertexts and produces the tally.** MACI prevents the coordinator from _attributing_ votes and from _faking_ the tally (zk proof), but standard MACI does not hide tally inputs from the coordinator. We never claim "nobody can decrypt ballots" or "hidden forever".
- **Self.xyz proves passport ownership**, not citizenship policy, at the UI layer. Binding verified proofs to MACI participation (uniqueness via nullifiers, policy via the eligibility contract) is S2.1. Until then the on-chain gate is `FreeForAllPolicy` and the demo must be presented as such.
- **The Graph indexer is infrastructure, not the source of truth.** Contracts are; the subgraph makes them queryable. Results UI must distinguish pending tally, verified tally, and unavailable (never render pending as zero).

### Why two keys

Every voter holds two independent keys:

| Key                       | Where it lives                                   | What it does                   |
| ------------------------- | ------------------------------------------------ | ------------------------------ |
| Wallet key (secp256k1)    | MetaMask / injected wallet                       | signs transactions, pays gas   |
| MACI keypair (babyjubjub) | generated in-browser, serialized in localStorage | joins the poll, encrypts votes |

The MACI key is the _voting identity inside the anonymity system_. Linking it to the
wallet key would make signups attributable (wallet → MACI key → ballots). MACI v3 has
no signature-derived keypair derivation, so the keypair is created client-side and
persisted. Known limitation (G04): the key is browser-scoped, not account-scoped.
Hydration must read an existing key and show a missing/recovery state, never silently
generate a replacement identity.

---

## 6. Architecture

### Current system (what exists)

```
  Participant
       │
       ├──> React application ──────> Self mobile proof ──> Backend verifier
       │                                                          │
       │                                                   browser flag
       │                                                          │
       │                                    ✗ MISSING BRIDGE (G01)│
       │                                    ~~~~~~~~~~~~~~~~~~~~~~X
       │                                                          ▼
       ├──> Injected wallet ──────────────────────────────> MACI policy
       │                                                          │
       │                                                          ▼
       │                                              MACI signup + membership
       │                                                          │
       │                                                          ▼
       │                                                  Encrypted publish
       │                                                          │
       │                                                          ▼
       │                                                  Graph event mappings
       │
       └──> Browser MACI key + receipt cache (localStorage, convenience only)
```

The Self path and the voting path exist, but a browser flag does not securely
connect them. The UI also uses mock poll data. A deployed `FreeForAll` policy does
not enforce verified-human eligibility.

### Target product architecture

```
   UI ───────> Wallet adapter ───> Participating account
   │                         └──> Sponsorship service
   │
   ├─────────> Self eligibility proof ──> Eligibility authorization ──> Contract policy
   │                                                                          │
   │                                        Participating account ────────────┤
   │                                                                          ▼
   │                                                                    MACI poll
   │                                                                          │
   │                                                                          ▼
   │                                                            Coordinator + verified tally
   │                                                                          │
   │                                                                          ▼
   │                                                                  Graph public read model
   │                                                                     │            │
   │   ENS public profile ──> UI <──────────────────────────────────────┘            │
   │                                                                                 ▼
   └──────────────────────────────────────────────────────────────────────> Read agent
                                                                                      │
                                                                                      ▼
                                                                          Controlled creation API
                                                                                      │
                                                                                      ▼
                                                                                  MACI poll
```

This diagram is a target. It does not select a Self bridge design, wallet vendor, or
tally-indexing strategy. [build.md](build.md) defines those choices and acceptance gates.

### Responsibilities

Self establishes configured document-derived eligibility. A policy enforces the
accepted credential, participating account and uniqueness rules. MACI handles
cryptographic registration, membership, encrypted commands and proof-verified
tallying. ENS provides public naming and discovery. Wallet infrastructure
signs/submits transactions and may sponsor execution. The Graph indexes public state
for UI and agents. Messari supplies reusable data-model conventions; it does not
verify or privatize votes.

The authoritative sources differ: contract policy for on-chain eligibility; chain
logs/state for membership and submission; verified tally state for results; an
integrity-bound descriptor for question/options; indexer for a derived read model.
Browser storage is a convenience cache.

## 7. Keys, identifiers and visibility

| Item                           | Responsibility / visibility                              | Consequence                                                                  |
| ------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Wallet owner key               | Signs for EOA or controls smart account                  | Must not be handled by agents; owner address may differ from contract caller |
| Participating account address  | Contract `msg.sender`; public chain context              | Bind policy and receipt namespace to this address                            |
| MACI private key               | Signs voting commands; currently browser localStorage    | Independent recovery problem; XSS/browser loss are material risks            |
| MACI public key and membership | Public protocol metadata                                 | A separate key alone does not erase signup transaction linkage               |
| Self nullifier                 | Scoped uniqueness signal under configured Self semantics | Verify scope and replay behavior; never assume it is a universal identity    |
| ENS name/profile               | Public, persistent pseudonym                             | Linking it to an account can increase cross-poll correlation                 |
| Encrypted command              | Public ciphertext/transaction metadata                   | Not an individual public plaintext ballot                                    |
| Coordinator key                | Enables command decryption/processing                    | Coordinator privacy and availability assumptions must be disclosed           |
| Tally/proof                    | Aggregate correctness evidence                           | Does not prove representative sampling or coordinator availability           |

Standard MACI relies on a coordinator who can decrypt messages. It aims at
anti-collusion properties under its protocol assumptions; it is not a guarantee of
anonymity against the coordinator, the app operator or correlated metadata. Consult
the [MACI introduction](https://maci.pse.dev/docs/introduction). Do not describe
ballots as "hidden forever" or "unattributable by anyone".

Self currently discloses nationality/gender to the verifier and returns disclosure
data. Minimize it in P2 rather than claiming that nothing reaches the backend.

## 8. Poll lifecycle

```
   Scheduled ──(chain start time)──> Open ──(chain end time)──> Closed
                                                                  │
                                                     (coordinator starts)
                                                                  ▼
                                                             Processing
                                                            │         │
                                          (tally proof accepted)   (failure / unavailable)
                                                            ▼         ▼
                                                         Verified   Delayed ──(retry)──┐
                                                            │                          │
                                          (aggregates indexed)                         │
                                                            ▼                          │
                                                        Published <────────────────────┘
```

Submission is an independent per-account state machine: unknown/checking →
eligible/member → submitting → pending → confirmed or failed. "Confirmed
submission" does not mean "counted". A closed poll may have no final results yet.
Merging the state tree is not tally completion. Indexing can lag even after on-chain
verification.

Use contract timestamps for schedule decisions, record indexing block/finality for
results, and expose unresolved states honestly.

## 9. Deployment ground truth (snapshot, Sep 4 2026)

Two MACI deployments exist on Sepolia. The canonical one is what the app, subgraph
and `.env.local` use; the 2025 record is archival and contains corrupted addresses.

|                                    | MACI                                         | Poll-0                                       | Status                                                            |
| ---------------------------------- | -------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------- |
| Aug 2025 (original)                | `0x88823dAdE6A8e8eb6C9226CB1CD9a0b5a3a9CA3c` | `0x8Efd5e3A…`                                | dead — old record only                                            |
| **Aug 2026 (revival) — CANONICAL** | `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a` | `0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB` | what the app + subgraph use; Poll-0 dates 0/0 → **never votable** |

Lesson encoded in `.env.example` and the contracts README: poll start/end dates are
constructor parameters — a poll without explicit dates accepts nothing. M1 ships a
fresh poll with explicit windows. Verify any chosen deployment against chain state
(`getStartAndEndDate()`), never against committed JSON.

## 10. Boundaries and success measures

Verification limits one kind of duplicate participation; it does not establish
representative sampling, informed consent to every use, or the correctness of a
poll's framing. Eligibility may exclude people without supported documents. Report
these limitations with the result.

Measure completion rate, time to first submission, verification failures,
proof-generation failures, transaction failures, refresh recovery, time to final
results, and repeat participation. Collect minimal operational telemetry without
ballot choices, identity documents, secret keys or raw verification payloads.

The release gate is a demonstrated complete journey, not a target metric invented
without observations. Record measured values and device/network conditions during
smoke tests.

## 11. Long-term shape

M2 adds poll creation/discovery, persistent ENS profiles, and dependable onboarding.
M3 adds standardized public data, natural-language queries, and constrained agent
creation. M4 adds resource panels and discussions with moderation, provenance and
separation from ballot choices.

An agent monitoring news can suggest a question and supporting sources. Initial
automated creation should be bounded by quotas, duplicate detection and a review
policy. The creator's identity and source provenance should be visible; generated
framing should not masquerade as neutral fact.

Discussion participation must not be automatically linked to a secret ballot. Do not
collect vote reasons, expose small demographic result slices, or monetize individual
opinions as part of the initial privacy promise.

Privacy-preserving demographic analytics is in long-term product scope — see
[demographic-analytics-spec.md](demographic-analytics-spec.md) (DA0–DA3). DA0 design
work may run alongside the critical path; DA1–DA3 follow M1. No demographic ballot
result may be claimed until authenticated attribute-to-counted-ballot linkage and
release protection exist.
