# Product journey, architecture and design rationale

**What this is:** the product journey, the system architecture, the trust
boundaries, and the reasoning behind the design.

- For **what exists in code right now**, read [journey-map.md](journey-map.md) and [status.md](status.md).
- For **what to build next**, read [roadmap.md](roadmap.md) and [build.md](build.md).

A design described here is not automatically implemented.

---

## 1. Purpose & Vision

VenekoVox is the truth layer for civic sentiment. Its foundation is eligibility backed by zero-knowledge identity proofs, private anti-coercion ballot submission, and publicly inspectable aggregate outcomes.

The project is informed by Alejandro's firsthand experience living across two opposing extremes of public expression:

- **State Repression (The Venezuelan Experience):** In environments where official elections are manipulated and dissent carries severe personal risk, citizens have no safe, credible way to demonstrate collective reality. Even when regime support craters below 10%, fear of blacklists and state retaliation suppresses any honest public signal.
- **Social Pressure & Cancellation (The Western / Australian Experience):** In open democracies, public discourse is frequently distorted by cancel culture and intense peer pressure. This creates a vast "silent majority"—citizens who withhold their genuine convictions for fear of professional ruin, social ostracization, or online mobbing.
- **Manufactured Narratives & Polling Collapse:** Traditional polling methods have experienced severe inaccuracies over recent election cycles, distorting societal expectations and breeding cynicism. Simultaneously, social media has become an arena of synthetic manipulation, weaponized by bot swarms and AI-generated personas.

VenekoVox replaces manufactured consensus with ground-truth conviction: **A neutral, un-fudgeable sentiment signal—the Polymarket of public opinion.**

Long-term, VenekoVox expands beyond single votes into an ongoing societal pulse:

- **The Civic Pulse:** Longitudinal tracking of recurring issues (e.g. executive approval, institutional trust, economic sentiment) to chart real shifts over time.
- **Grounded Discourse & Resources:** Balanced context hubs for each poll—policy briefs, opposing arguments, verifiable citations, and AI-assisted debate synthesis (drawing from paradigms like Grok on X) to cut through bot propaganda and clarify the friction points of public debate.

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
3. Verify the required eligibility through Self Enterprise (planned replacement for the existing legacy Pass UI). Explain requested disclosures before scanning. Verification failure offers a recoverable path.
4. Authorize the actual participating account under the poll's policy. A UI success flag is insufficient.
5. Submit a choice. The application handles signup, poll membership and encrypted publish, exposes understandable progress, and prevents duplicate concurrent actions.
6. Refresh or reconnect. Recover chain-backed participation and transaction status without showing another account's state. Explain key loss separately from wallet disconnection.
7. After closing, return to proof-verified aggregate results. Show tally/indexing progress while results are unavailable.

A CLI/operator-created poll is acceptable for M1. A complete public creation flow
is a later milestone. Smart-wallet compatibility and eligibility binding must be
decided together before a final M1 policy deployment.

## Target journey — proposed

**Design intent, not shipped behavior.** The as-built counterpart remains
[journey-map.md](journey-map.md). Stage IDs refer to [roadmap.md](roadmap.md).
ENS and community features are extensions; they are not extra requirements for M1.

### Onboarding and the optional public profile

```
  ONBOARDING AND THE OPTIONAL PUBLIC PROFILE

   1 Open poll, read eligibility
        │
        ▼
   2 Connect or recover participating account
        │
        ├──────────────────────────────┐
        │                              │  (optional side path)
        ▼                              ▼
   3 Self eligibility           E  ENS name registration
     verification                      │  or resolution
        │                              ▼
        ▼                          F  Display verified name
   4 Contract participation             — or address fallback
     authorization
        │
        ▼
   5 Enter ballot flow

   NOTE: there is deliberately NO arrow from ENS (E) to authorization (4).
         A name identifies a public profile; it neither proves personhood
         nor permits voting.
```

There is deliberately no arrow from ENS to authorization. A name identifies a
public profile; it neither proves personhood nor permits voting. Resolve the
participating account, not a different owner/signing address. Explain public
linkage before registration; name-service failure must not block an eligible vote.

### Submission, interruption and results

```
  SUBMISSION, INTERRUPTION AND RESULTS

   A  Authorized account + recoverable MACI key
        │
        ▼
   B  Check signup and poll membership
        │
        ▼
   C  Sign command, encrypt with ephemeral key
        │
        ▼
   D  Publish to the selected Poll
        │
        ▼
   E  Persist identifiers and verify execution
        │
        ├──────────────────────────────┐
        │  interrupted or              │
        │  outcome unknown             │
        ▼                              ▼
   F  Submission confirmed        R  Restore captured context
        │                              │  and reconcile
        │                              │
        │◄─────────────────────────────┘  (retry loops back to E)
        ▼
   T  After close: process and verify tally
        │
        ▼
   P  Publish complete checked aggregates
        │
        ▼
   I  Index provenance and display results
```

This is an application sequence, not one atomic on-chain transaction. Signup,
join and publish may complete separately. An interrupted or timed-out send may
already have broadcast; reconcile before retrying. A confirmed publication does
not guarantee the encrypted command will be counted under MACI rules.

### Step contracts for implementation and review

| User moment / stage               | What executes (proposed where absent)                                              | Data and trust boundary                                                                        | Success evidence                                                           | Failure / recovery                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Understand the poll / S3.2        | Load a descriptor bound to chain, Poll and ordered options; read schedule/policy   | Public question and metadata; editorial resources separate from ballot definition              | Descriptor and deployed configuration agree                                | Disable submission on mismatch; failed load is not an empty poll                    |
| Connect / S2.2                    | Injected fallback or tested sponsored-account adapter                              | Wallet custody/recovery and gas sponsorship; actual caller may differ from outer sender        | Correct account/chain and zero-ETH experiment evidence                     | Recover session; denied sponsorship never silently spends user ETH                  |
| Verify / S2.1                     | Self Enterprise result under declared policy; enforce authorization on signup/join | Minimized disclosures; scoped nullifier/replay binding; no identity payload in public profiles | Eligible passes and bypass/replay/wrong-account fail                       | Expired or rejected proof offers retry; two wallets must not bypass uniqueness      |
| Choose a name / S1.1              | Optional subname registration and verified resolution                              | Public name links to account/history; no Self attributes or ballot data                        | Real registry/resolver evidence and forward/reverse match where applicable | Missing name, collision or resolver outage falls back to address                    |
| Prepare ballot / S3.1             | Recover MACI key; lookup signup/join; generate join proof                          | Independent signing key and proving assets; current public-key reuse permits linkage           | Correct membership context and proof accepted                              | Missing key is a recovery state; do not silently replace registered key             |
| Submit / S3.1                     | Sign command; ephemeral ECDH encryption; publish to Poll                           | Ciphertext and transaction metadata public; coordinator can decrypt                            | Direct-EOA or validated sponsored-execution evidence for this Poll/account | Save failure retains in-memory identifiers; unknown outcome requires reconciliation |
| Return / S3.1                     | Restore original context and query chain/vendor                                    | Cached IDs are recovery hints, not proof                                                       | No stale account/operation can overwrite current state                     | RPC outage is unknown; wallet recovery alone does not restore MACI key              |
| Inspect results / S4.1, S5.1–S5.2 | Verify tally, publish checked options, index and render provenance                 | Public aggregates; commitments and completeness checked before finality                        | Same totals from verified source, query and UI, with block/version         | Processing, incomplete publication, reorg and indexer lag stay visible              |
| Learn/discuss / M4                | Resource panel and separately moderated discussion                                 | Public discussion must not require attaching a ballot choice                                   | Source provenance, moderation and profile behavior work                    | Resources/discussion can fail without blocking the ballot                           |
| Ask an agent / S5.3–S5.4          | Read public metadata/results; later constrained poll creation                      | No private keys, Self payloads or human-ballot authority                                       | Cited answer or authorized, idempotent creation                            | Unsupported claims remain unanswered; payment/deploy failures reconcile             |

### Growing this map without growing the document set

For each implemented step, update its as-built call path, captured identifiers,
failure/recovery branch and source permalink in the same change. Mark evidence
separately as source-reviewed, locally tested or live-verified. Promote a design
only after its implementation and acceptance evidence exist. Keep operator/tally
work visible even when it runs after the participant has left the page.

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

MACI combines encrypted commands, protocol rules for valid votes and key changes,
and proofs of tally computation. Its anti-collusion properties are not a guarantee
that participation or choices are unattributable to the coordinator. The current
application does not demonstrate the full anti-collusion user journey. Joining
nullifiers prevent repeated membership under the circuit rules; they do not
establish Self-unique humans or anonymously spend every ballot.

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

- **The coordinator can decrypt commands and produces tally proofs.** Contract verification constrains accepted computations under the protocol and circuit assumptions. It does not prevent correlation with public keys, participation records or transaction metadata, and does not guarantee coordinator availability. We never claim "nobody can decrypt ballots" or "hidden forever".
- **Self.xyz proves passport ownership**, not citizenship policy, at the UI layer. Binding verified proofs to MACI participation (uniqueness via nullifiers, policy via the eligibility contract) is S2.1. Until then the on-chain gate is `FreeForAllPolicy` and the demo must be presented as such.
- **The Graph indexer is infrastructure, not the source of truth.** Contracts are; the subgraph makes them queryable. Results UI must distinguish pending tally, verified tally, and unavailable (never render pending as zero).

### Why two keys

The current flow uses separate key material for three purposes:

| Key                          | Where it lives                                   | What it does                                           |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Wallet key (secp256k1)       | MetaMask / injected wallet                       | signs transactions, pays gas                           |
| MACI keypair (babyjubjub)    | generated in-browser, serialized in localStorage | identifies membership and signs commands               |
| Ephemeral encryption keypair | generated for a submission                       | derives an ECDH secret with the coordinator public key |

Independent key generation does not remove public linkage. In this application,
signup and joining reuse the MACI public key, and transaction metadata is public.
The coordinator can decrypt commands; do not promise participation anonymity.
The MACI keypair is created client-side and persisted. In
[generateVote](../packages/sdk/ts/vote/generate.ts), the command is signed with
the MACI private key but encrypted using a separate ephemeral private key and
the coordinator public key. Known limitation (G04): the key is browser-scoped, not account-scoped.
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
