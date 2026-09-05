# VenekoVox — verified humans, anonymous votes, verifiable results

[![CI][cli-actions-badge]][cli-actions-link]
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/privacy-scaling-explorations/maci/blob/main/LICENSE)

A privacy-first civic polling platform: people prove they are real, unique humans with
their passport (Self.xyz zk proofs), vote through [MACI](https://maci.pse.dev/) so no one
— not even we — can link a ballot to a face, and anyone can verify the aggregate result
on-chain.

## What makes it different

- **Verified humans, not wallets.** Self.xyz proves passport ownership with zero-knowledge
  proofs. One person, one voice — without learning who the person is.
- **Anonymous by cryptography, not by policy.** Votes are encrypted messages processed
  through MACI. The coordinator can tally; nobody can attribute.
- **Auditable aggregates.** Registration counts, submitted messages and the final tally
  are all public on-chain. The _individual_ is private; the _result_ is verifiable.
- **Agent-operable data layer** _(in progress)_: a standardized, privacy-aware subgraph so
  humans and AI agents can query results without trusting a dashboard.

## How a vote works (60-second version)

```
 Voter                    Front-end (browser)                Chain (Sepolia)
   │                             │                                │
   │  scan Self QR (passport)    │                                │
   ├────────────────────────────>│  verify proof (backend)        │
   │                             ├───────────────────────────────>│  MACI.signup()
   │                             │                                │
   │  click vote (ONE click)     │                                │
   ├────────────────────────────>│  join poll: zk proof in-browser│
   │                             │  (snarkjs WASM, ~3MB assets)   │
   │                             ├───────────────────────────────>│  Poll.joinPoll()
   │                             │  encrypt vote to coordinator pk│
   │                             ├───────────────────────────────>│  Poll.publish()
   │                             │                                │
   │  refresh anytime → state +  │                                │
   │  receipt restored from chain│                                │
```

What is public vs private:

|                         | Visible on-chain             | Hidden forever        |
| ----------------------- | ---------------------------- | --------------------- |
| Who signed up           | ✅ (wallet address)          | which human it is     |
| How many joined / voted | ✅ (counts)                  | who they are          |
| Vote contents           | ❌ encrypted                 | ballot choice         |
| Final tally             | ✅ + zk proof of correctness | per-voter attribution |

## Current status (honest)

- ✅ **P1 — reliable voting interaction**: one-click signup→join→vote, refresh hydration,
  wallet-switch safety, persisted submission receipts. See [docs/vote-flow-review.md](docs/vote-flow-review.md)
  and [docs/hydration-receipts.md](docs/hydration-receipts.md).
- ⚠️ **Eligibility is not yet enforced on-chain** (P2): the deployed gate is
  `FreeForAllPolicy`. Self.xyz verification is wired in the UI; binding it to MACI
  participation is the next milestone. Do not cite the demo as sybil-proof yet.
- ⚠️ **Poll page uses mock metadata/results** (P3 pending). "Encrypted vote submitted"
  ≠ counted vote; results render from config, not the tally.
- ⚠️ **No poll is currently votable**: Poll-0 of the Aug 2026 deployment has start/end
  dates 0/0 (verified on-chain). A fresh poll with explicit dates is created as part of
  M1 sign-off.
- 📋 Roadmap & execution order: one trustworthy poll (M1) → usable polling platform (M2)
  → standardized agent-readable data (M3) → informed community (M4).

## Quick start (developers)

Requirements: Node 20.x, pnpm v10 (`corepack pnpm` works), a Sepolia-funded deployer wallet.

```bash
# 1. Install + build the monorepo
pnpm install && pnpm rebuild keccak secp256k1 blake-hash esbuild ssh2
pnpm download-zkeys:test          # ~1.2GB, required for poll deployment

# 2. Deploy MACI core (from packages/contracts, .env per .env.example)
pnpm deploy:sepolia               # addresses land in deployed-contracts.json

# 3. Create a poll — MUST set explicit start/end dates
#    (see packages/contracts/tasks/deploy/poll/; dates are constructor params)

# 4. Front-end (apps/front-end): copy .env.example → .env.local, fill in
#    VITE_MACI_ADDRESS, VITE_POLL_ID, VITE_MACI_START_BLOCK
pnpm dev

# 5. Backend verifier (apps/backend, port 3100)
pnpm dev
```

Tests:

```bash
cd apps/front-end && pnpm test:unit   # vote-flow + receipt-store suites (node --test)
cd apps/subgraph  && pnpm test        # matchstick indexer tests
```

> ⚠️ **The 2025 deployment record is historical.**
> `packages/contracts/deployed/sepolia-deployment.json` documents the original 2025
> hackathon deployment (several addresses in it are corrupted and were never valid).
> The canonical Aug 2026 deployment is MACI `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`
> (Poll-0 `0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB`, block 11567347). Trust
> `deployed-contracts.json` (regenerated at deploy time) and `apps/front-end/.env.example`.

## Documentation

| Doc                                                      | Contents                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [docs/vote-flow-review.md](docs/vote-flow-review.md)     | P1 vote-flow redesign: atomic submission, locks, recovery, and the validation checklist               |
| [docs/hydration-receipts.md](docs/hydration-receipts.md) | Refresh hydration + receipt persistence: context-scoped keys, wallet-switch guards, failure semantics |
| [docs/architecture.md](docs/architecture.md)             | System architecture: components, vote journey, privacy model, design reasoning                        |

## Repository layout

```
apps/
  front-end/    React + Vite dApp (vote journey, Self.xyz QR flow)
  backend/      Self.xyz proof verifier (port 3100)
  coordinator/  MACI coordinator operations
  relayer/      message relaying
  subgraph/     The Graph indexer for MACI events (sepolia config)
packages/
  contracts/    MACI v3 contracts + deploy tasks (deployed-contracts.json = source of truth)
  sdk/          @maci-protocol/sdk (browser entrypoint drives in-browser proving)
  ...
```

## Upstream MACI (reference)

VenekoVox is a fork + extension of [`privacy-ethereum/maci`](https://github.com/privacy-ethereum/maci)
(v3.0.0 base, upstream archived Aug 2026 — we maintain this fork). The upstream monorepo
docs below still apply for development workflows.

[cli-actions-badge]: https://github.com/satojandro/venekovox/actions/workflows/ci.yml/badge.svg
[cli-actions-link]: https://github.com/satojandro/venekovox/actions/workflows/ci.yml

<!-- ───────────────────────── Upstream sections ───────────────────────── -->

## Development and testing

### Branches

- `main` has the latest stable version.
- `feat/*` branches carry work in review.

### Local development

```bash
git clone https://github.com/satojandro/venekovox.git
cd venekovox
corepack pnpm install
corepack pnpm rebuild keccak secp256k1 blake-hash esbuild ssh2
corepack pnpm run build
```

### Testing

```bash
corepack pnpm run test
```

### CI pipeline

GitHub Actions runs types, lint and builds on every pull request.
