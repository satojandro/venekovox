# VenekoVox architecture

_Why the system looks the way it does — components, data flow, and the reasoning
behind each decision. Written to be read; if something here is unclear, that's a
bug in the doc._

## 1. The problem shape

Public on-chain voting has two failure modes that push in opposite directions:

- **Open voting is buyable.** If ballots are attributable, a briber can verify
  compliance. On-chain attribution makes vote-buying _auditable_ — by the buyer.
- **Hidden voting is unauditable.** If nobody can see anything, the operator can
  invent results.

MACI's answer: **attribute nothing to anyone, but prove the aggregate.** Votes are
encrypted to a coordinator, spent with nullifiers (one ballot per identity), and the
final tally ships with a zk-proof of correct computation. Bribery becomes
_verification-blind_ — a briber cannot check how their victim voted — while anyone
can still verify that the published tally is the honest decryption of the real ballots.

VenekoVox adds the missing layer on the identity side: **proof of unique humanness**
via Self.xyz passport zk-proofs, so "one person, one voice" doesn't depend on wallet
counting (wallets are free; humans aren't).

## 2. Components

```
┌──────────────────────── Browser (apps/front-end) ────────────────────────┐
│  React + Vite dApp                                                       │
│   useMaci.ts   — wallet, hydration, submission state machine             │
│   voteFlow.ts  — atomic signup→join→publish operation (pure TS, tested)  │
│   receipts.ts  — context-scoped submission receipts (localStorage)       │
│   Self QR      — passport verification entry (@selfxyz/qrcode)           │
│   snarkjs WASM — PollJoining zk-proof generated in-browser (~3MB assets) │
└───────────────┬──────────────────────────────────┬──────────────────────┘
                │ tx (injected wallet signs)       │ POST /verify
┌───────────────▼───────────────┐   ┌──────────────▼─────────────────────┐
│ Sepolia (packages/contracts)  │   │ apps/backend — Self.xyz verifier   │
│  MACI core · Poll · Tally     │   │ @selfxyz/core, scope-bound proofs  │
│  events: DeployPoll, SignUp,  │   └────────────────────────────────────┘
│  PollJoined, PublishMessage,  │
│  MergeState, ChainHashUpdated │
└───────────────┬───────────────┘
                │ indexed by
┌───────────────▼───────────────┐
│ apps/subgraph (The Graph)     │  → results/trends for humans AND agents (M3)
└───────────────────────────────┘
```

## 3. The vote journey (as implemented after P1)

```
click "vote"
  → createVoteFlow() takes a synchronous lock (double-clicks cannot double-spend)
  → capture context {chainId, MACI, pollId, account}  ← every receipt uses THIS
  → getSignedupUserData()      ── already registered? skip signup
  → signup()                   ── one-time MACI registration (wallet signs)
  → getJoinedUserData()        ── already joined? skip join (refresh-safe)
  → joinPoll()                 ── zk proof in-browser (PollJoining circuit)
  → publish()                  ── encrypted vote message (nonce 1, no updates yet)
  → save receipt under captured context, THEN report success to the UI
```

Reasoning, per step:

- **One async operation, not three UI steps.** The original 2025 flow passed state
  through React renders; the first click published with a stale index. The flow now
  passes the fresh `pollStateIndex` directly into `publish`. React state is
  display-only.
- **Chain-first recovery.** Signup/join are _looked up_ before they are _executed_,
  so a refresh or a rejected tx never re-submits a transaction — membership is a
  fact on-chain, not app state.
- **`lookup-failed` ≠ "not registered".** A failed RPC is not knowing. UI copy and
  state machine keep these apart (trust requirement, not polish).
- **Receipts record submission, not counting.** Key =
  `chainId:MACI:pollId:wallet`, contents = tx hash + timestamp. Counting is the
  tally's business (P4). Corrupt/missing storage reads as "unable to confirm".
- **Wallet-switch safety.** Context is captured at submission start; a mid-flight
  account switch files the receipt under the _original_ wallet and the page will
  not display it under the new one.

## 4. Key management

Every voter holds two independent keys:

| Key                       | Where it lives                                   | What it does                   |
| ------------------------- | ------------------------------------------------ | ------------------------------ |
| Wallet key (secp256k1)    | MetaMask / injected wallet                       | signs transactions, pays gas   |
| MACI keypair (babyjubjub) | generated in-browser, serialized in localStorage | joins the poll, encrypts votes |

Why separate: the MACI key is the _voting identity inside the anonymity system_.
Linking it to the wallet key would make signups attributable (wallet → MACI key →
ballots). MACI v3 has no signature-derived keypair derivation, so the keypair is
created client-side and persisted. Known limitation (tracked): the key is
browser-scoped, not account-scoped — switching wallets reuses the same voting key
until key migration ships.

## 5. Trust assumptions (stated plainly)

- **The coordinator sees ciphertexts and produces the tally.** MACI prevents the
  coordinator from _attributing_ votes and from _faking_ the tally (zk proof), but
  standard MACI does not hide the tally inputs from the coordinator. We do not
  claim "nobody can decrypt ballots."
- **Self.xyz proves passport ownership**, not citizenship policy, at the UI layer.
  Binding verified proofs to MACI participation (uniqueness via nullifiers, policy
  via the eligibility contract) is P2 — until then the on-chain gate is
  `FreeForAllPolicy` and the demo must be presented as such.
- **The Graph indexer is infrastructure, not the source of truth.** Contracts are;
  the subgraph makes them queryable. Results UI must distinguish pending tally,
  verified tally, and unavailable (never render pending as zero).

## 6. Deployment ground truth (Sepolia)

|                          | MACI              | Poll-0            | Notes                                                                     |
| ------------------------ | ----------------- | ----------------- | ------------------------------------------------------------------------- |
| Aug 2025 (original)      | `0x88823dAd…CA3c` | `0x8Efd5e3A…`     | historical; committed record has corrupted entries                        |
| **Aug 2026 (canonical)** | `0x44F31f38…Fe3a` | `0x29D39dD4…22CB` | deployed 2026-08-25, block 11567347; **Poll-0 dates 0/0 → never votable** |

Lesson encoded in `.env.example` and the contracts README: poll start/end dates are
constructor parameters — a poll without explicit dates accepts nothing. M1 ships a
fresh poll with explicit windows.

## 7. What comes next (data & indexing)

- **P3** — poll page reads real config + chain state (options, timing, eligibility),
  distinct open/closed/awaiting-tally/verified-result states.
- **P4** — coordinator runs processing + tally; results enter the subgraph and UI
  with provenance (poll → tally contract → proof-verified aggregate).
- **Schema v2 (M3)** — extend the Messari governance standard with a
  `BallotPrivacy` dimension (PUBLIC / PSEUDONYMOUS / ANONYMOUS): nullable voter and
  choice under anonymity, `TallyResult` as the proof-gated aggregate. One query
  spans public Governor proposals and anonymous MACI polls.
