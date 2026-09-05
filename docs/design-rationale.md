# Design rationale (why the code looks this way)

This page preserves the reasoning behind VenekoVox's core design so the technical
docs (architecture, current state) can stay lean and factual. It is **rationale,
not status** — for what is actually implemented or verified today, read
[current state](current-state.md). Decisions and their owners live in the
[decision register](decisions.md).

## The problem shape

Public on-chain voting has two failure modes that push in opposite directions:

- **Open voting is buyable.** If ballots are attributable, a briber can verify
  compliance. On-chain attribution makes vote-buying _auditable_ — by the buyer.
- **Hidden voting is unauditable.** If nobody can see anything, the operator can
  invent results.

MACI's answer: **attribute nothing to anyone, but prove the aggregate.** Votes are
encrypted to a coordinator, spent with nullifiers (one ballot per identity), and
the final tally ships with a zk-proof of correct computation. Bribery becomes
_verification-blind_ — a briber cannot check how their victim voted — while anyone
can still verify that the published tally is the honest decryption of the real ballots.

VenekoVox adds the missing layer on the identity side: **proof of unique humanness**
via Self.xyz passport zk-proofs, so "one person, one voice" doesn't depend on wallet
counting (wallets are free; humans aren't).

## The P1 vote journey (design reasoning)

The 2025 flow passed state through React renders and published with a stale index.
P1 replaced it with one atomic operation (`voteFlow.ts`), for these reasons:

- **One async operation, not three UI steps.** The flow captures
  `{chainId, maciAddress, pollId, account}` at submission start; the fresh
  `pollStateIndex` is passed directly into `publish`. React state is display-only.
- **Chain-first recovery.** Signup/join are _looked up_ before they are _executed_,
  so a refresh or a rejected tx never re-submits a transaction — membership is a
  fact on-chain, not app state.
- **`lookup-failed` ≠ "not registered".** A failed RPC is not knowing. UI copy and
  the state machine keep these apart (trust requirement, not polish).
- **Receipts record submission, not counting.** Key = chain + MACI + poll + wallet;
  contents = tx hash + timestamp. Counting is the tally's business (P4).
  Corrupt/missing storage reads as "unable to confirm".
- **Wallet-switch safety.** Context is captured at submission start; a mid-flight
  account switch files the receipt under the _original_ wallet and the page will
  not display it under the new one.

## Key management

Every voter holds two independent keys:

| Key                       | Where it lives                                   | What it does                   |
| ------------------------- | ------------------------------------------------ | ------------------------------ |
| Wallet key (secp256k1)    | MetaMask / injected wallet                       | signs transactions, pays gas   |
| MACI keypair (babyjubjub) | generated in-browser, serialized in localStorage | joins the poll, encrypts votes |

Why separate: the MACI key is the _voting identity inside the anonymity system_.
Linking it to the wallet key would make signups attributable (wallet → MACI key →
ballots). MACI v3 has no signature-derived keypair derivation, so the keypair is
created client-side and persisted. Known limitation (tracked as G04): the key is
browser-scoped, not account-scoped — switching wallets reuses the same voting key
until key migration/recovery ships. Hydration must read an existing key and show a
missing/recovery state, never silently generate a replacement identity.

## Trust boundaries (stated plainly)

- **The coordinator sees ciphertexts and produces the tally.** MACI prevents the
  coordinator from _attributing_ votes and from _faking_ the tally (zk proof), but
  standard MACI does not hide tally inputs from the coordinator. We never claim
  "nobody can decrypt ballots" or "hidden forever".
- **Self.xyz proves passport ownership**, not citizenship policy, at the UI layer.
  Binding verified proofs to MACI participation (uniqueness via nullifiers, policy
  via the eligibility contract) is P2. Until then the on-chain gate is
  `FreeForAllPolicy` and the demo must be presented as such.
- **The Graph indexer is infrastructure, not the source of truth.** Contracts are;
  the subgraph makes them queryable. Results UI must distinguish pending tally,
  verified tally, and unavailable (never render pending as zero).

## Deployment ground truth (snapshot, Sep 4 2026)

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
