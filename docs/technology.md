# Technology and Evidence Guide

Read with [docs/README.md](README.md) (the story) — this file is the technology-by-technology evidence table. Every claim here was re-verified on 2026-09-13 (submission day) against live endpoints and on-chain state.

---

## What VenekoVox Is

A zero-knowledge civic polling platform: verified humans express genuine opinions without fear of retaliation. Four technologies carry it:

| Technology     | Role                                                                                          | Why it matters here                                              |
| -------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **ZKPassport** | Proves you're a real human (passport NFC scan, age 18+, facematch) without revealing identity | One-person-one-vote without knowing who anyone is                |
| **MACI**       | Encrypts ballots so no one — not even the operator — can prove how you voted                  | Anti-coercion, anti-vote-buying; re-voting neutralizes blackmail |
| **The Graph**  | Indexes on-chain events into standardized, queryable governance data                          | Public audit of participation and results                        |
| **ENSv2**      | Human-readable poll names (`superintelligence.polls.venekovoxv1.eth`)                         | Polls are discoverable, shareable on-chain objects               |

The product grew from Alejandro's firsthand experience of suppressed civic voice in Venezuela and Australia.

---

## Prize Track Evidence

### The Graph — Best Use of Composable or Standardized Graph Products

**Track requirement (sponsor language):** build meaningfully on a standardized schema (e.g. Messari Standardized Subgraphs); consume live data from a Graph provider; show what became easier because a shared schema was used.

**What we did:** We indexed MACI — a private-voting protocol with no standard public schema — into a subgraph aligned with the **Messari governance schema**, consumed live from Subgraph Studio. One query pattern serves registrations, schedules, message counts, and (post-tally) results, and generalizes to any MACI-style deployment.

**The novel fit for a privacy protocol:** standardized governance schemas are built for transparent voting — they index _who_ voted. Ours indexes _that_ eligibility-proven voters exist (StateLeaves, zero-knowledge registrations), poll metadata, and the **proof-verified tally** — never the ballot. We extend the standard's shape to a domain it wasn't designed for: privacy-preserving governance.

**Evidence:**

- ✅ Subgraph deployed to Graph Studio, deployment `QmeBkGteYdc7bQeHD2FneLBG1dm5MHcMbvgYPiKxAfqDeM`
- ✅ **Verified live 2026-09-13:** queries return `hasIndexingErrors: false`, sync at block 11,696,166
- ✅ All 4 polls indexed; Poll 3 (flagship) with `numMessages: 1` and live schedule (start/end 2026-09-13/14 UTC)
- ✅ Indexed entities: `StateLeaf` (registrations), `Poll` (metadata, schedule, mode, tree depth), `TallyResult` (post-tally)
- ✅ Query shape: `{ polls { pollId registrationCount numMessages startDate endDate } }` — one pattern, every governance question
- ✅ Messari governance schema compatibility documented (v2 projection)
- ✅ Schema design write-up: [blog/2026-09-07-maci-messari-governance-schema.md](blog/2026-09-07-maci-messari-governance-schema.md)

**Endpoint:** `https://api.studio.thegraph.com/query/1758839/venekovox-governance-v-2/wp4-state-leaves`

**What the standard bought us:** the backend's indexed-tree service rehydrates the MACI state tree **directly from subgraph StateLeaves** — one standardized data source powers both public audit and the live join-witness path, instead of a bespoke indexer per consumer.

---

### ENS — Best Use of ENSv2

**Track requirement (sponsor language):** built on ENSv2 (Sepolia); ENSv2 central to the product, not cosmetic; functional demo, not hard-coded values.

**What we did:** ENSv2 is the product's **discovery and naming layer**. We deployed `VenekoVoxNames`, our own ENSv2 subname registry on Sepolia, so every poll is named on-chain under our hierarchy: `venekovoxv1.eth` → `polls.venekovoxv1.eth` → `<label>.polls.venekovoxv1.eth`. The flagship poll is live as `superintelligence.polls.venekovoxv1.eth`; the front-end resolves poll names through the universal resolver at runtime — nothing hard-coded.

**The novel fit:** a poll's ENS name is simultaneously its **address, its brand, and its share-link**. Naming a civic poll the way you name a wallet or a website makes polls legible, portable, and shareable — civic infrastructure with the same identity ergonomics as everything else on Ethereum.

**Evidence:**

- ✅ VenekoVoxNames deployed Sepolia: `0x870A12e8274A165C7bCa64B563aAaeD2655E8369` (verified bytecode presence 2026-09-13)
- ✅ Poll 3 named: `superintelligence.polls.venekovoxv1.eth`
- ✅ Operator-only `namePoll(label, pollId)` — poll naming is a governed operation, not open minting
- ✅ Full ENSv2 hierarchy under our own subname registry (new ENSv2 registry structure)
- ✅ Frontend resolves poll names via ENS universal resolver (live resolution, not literals)
- ✅ Full deployment + verification record: [ens-deployment.md](ens-deployment.md), [ens-registration.md](ens-registration.md)

---

### MACI — the anti-coercion core

**What it does:** encrypts ballot submissions to a coordinator using ZK proofs; even a bribing or coercing observer cannot prove how you voted (re-voting is invisible to outsiders), and the final tally is verified on-chain via ZK-SNARKs.

**The archive fact, stated plainly:** `privacy-ethereum/maci` was archived (read-only) on **Aug 19, 2026**. VenekoVox deployed MACI v3-era contracts, integrated them with ZKPassport eligibility, and ran a complete journey **after** that date. We treat this as a strength: the protocol is stable, fully public, and auditable, and our deployment demonstrates it remains production-usable infrastructure for private governance.

**Evidence:**

- ✅ Verify → join → vote flow exercised live; tally machinery (merge → prove → submit) audited and zkeys verified — proof-verified tally is the next milestone
- ✅ Real-document ZKPassport session (Sep 11, 2026 — real AU passport, salted uniqueness, strict facematch)
- ✅ 122 frontend unit tests passing (latest full run, Sep 13; prior suites 52/52 on vote/receipt paths)
- ✅ Live Poll 3 (flagship) deployed and accepting votes — window open Sep 13→14 UTC (verified on-chain 2026-09-13)

**Deployed contracts (Sepolia):**

- MACI: `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`
- Poll 3: `0x604a8a64787659FEc944bE4aa407bA8805C46562`
- Tally 3: `0x25c02FA61C4a34d8E3F97A7893216843F14621D6`

---

### ZKPassport — the eligibility layer that replaces the trusted operator

**What it does:** verifies you're a real human using your passport's NFC chip. The proof is generated on-device — the server never sees your name, nationality, or personal data. Salted uniqueness means one person = one vote with no cross-poll tracking; strict facematch against the issuing state's chip photo blocks deepfake attacks.

**How it differs from standard MACI:** standard MACI uses a trusted operator to manage the eligibility list — a single point of trust and failure. VenekoVox replaces this with ZKPassport: the user's own passport proves eligibility via zero-knowledge proof, and the operator never sees user identity. The contract only sees a cryptographic proof that the user is eligible.

**Evidence:**

- ✅ Real-document session passed (D18, Sep 11, 2026)
- ✅ Salted uniqueness mode (`NullifierType.SALTED`) — one vote per person per poll
- ✅ Strict facematch against issuing-state chip photo
- ✅ Age 18+ verification (no nationality restriction for flagship poll)
- ✅ EIP-712 authorization consumed on-chain by `SelfEligibilityPolicy` (`0x7Bb4ff758816d621e1e30191a7D496EFC38eb902`)
- ✅ Negative tests: wrong account, replay, expiry, bypass

---

## The Differentiator

| Standard MACI                     | VenekoVox                                        |
| --------------------------------- | ------------------------------------------------ |
| Operator manages eligibility list | User's passport proves eligibility               |
| Operator sees who's eligible      | Operator sees nothing                            |
| Single point of trust             | Distributed trust (passport issuer + ZKPassport) |
| Requires pre-registration         | Self-service verification                        |
| Results audited ad hoc            | Standardized, queryable audit via The Graph      |
| Polls known by opaque poll IDs    | Polls named and discoverable via ENSv2           |

---

## Honest Limitations

- **Testnet only.** All contracts are on Sepolia. Mainnet deployment is a future milestone.
- **Single coordinator.** The MACI coordinator is a single operator. Distributed coordination is a post-hackathon goal.
- **Demo poll.** The flagship poll is a demonstration, not a statistically representative survey.
- **Nationality not gated.** The flagship poll accepts any passport (age 18+). Stage 2 adds opt-in demographic breakdowns.
- **No vote-buying protection at the UI level.** MACI protects against on-chain vote buying, but a coercer could still watch the screen.
- **MACI upstream is archived.** We see stability in this, but long-term it means the VenekoVox team owns maintenance of our deployment.

---

## Post-hackathon

This is a product, not a project. The plan — real users, recurring civic polls, opt-in demographic analytics, mainnet — is in [roadmap.md](roadmap.md).

## Further Reading

- [journey.md](journey.md) — product journey, architecture, trust boundaries
- [flagship-poll-manifest.md](flagship-poll-manifest.md) — flagship poll specification
- [archive/status.md](archive/status.md) — full implementation-truth ledger (gaps G01–G13, evidence)
- [archive/journey-map.md](archive/journey-map.md) — call-by-call ASCII map of every contract hop
- [blog/](blog/) — publishable engineering write-ups
