# Technologies and Judge Guide

## What VenekoVox Is

VenekoVox is a zero-knowledge civic polling platform that lets verified humans express genuine opinions without fear of retaliation. It combines:

- **ZKPassport** — proves you're a real human (passport scan, age 18+, facematch) without revealing your identity
- **MACI** — encrypts ballots so no one can prove how you voted (anti-coercion, anti-vote-buying)
- **The Graph** — indexes on-chain events into queryable governance data
- **ENS V2** — human-readable poll names for discovery (`superintelligence.polls.venekovoxv1.eth`)

The product grew from Alejandro's firsthand experience of limited civic voice in Venezuela and Australia.

---

## Prize Track Evidence

### MACI (Core Infrastructure)

**What it does:** Encrypts ballot submissions to a coordinator using ZK proofs. Even if someone looks over your shoulder or offers to buy your vote, MACI makes it mathematically impossible to prove how you voted. The tally is verified on-chain via ZK-SNARKs.

**Evidence:**

- ✅ Full end-to-end flow: verify → join → vote → close → tally (poll 2 proof)
- ✅ Real-document ZKPassport session (Sep 11, 2026 — real AU passport, salted uniqueness, strict facematch)
- ✅ 52 unit tests passing
- ✅ Live poll 3 (flagship) deployed and accepting votes
- ✅ Tally machinery tested (merge → prove → submit on-chain)

**Deployed contracts (Sepolia):**

- MACI: `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`
- Poll 3: `0x604a8a64787659FEc944bE4aa407bA8805C46562`
- Tally 3: `0x25c02FA61C4a34d8E3F97A7893216843F14621D6`

---

### ZKPassport (Identity Verification)

**What it does:** Verifies you're a real human using your passport's NFC chip. The proof is generated on-device — the server never sees your name, nationality, or personal data. Uses salted uniqueness (one person = one vote, no cross-poll tracking) and strict facematch (prevents deepfake attacks).

**Evidence:**

- ✅ Real-document session passed (D18, Sep 11, 2026)
- ✅ Salted uniqueness mode (NullifierType.SALTED) — one vote per person per poll
- ✅ Strict facematch against issuing-state chip photo
- ✅ Age 18+ verification (no nationality restriction for flagship poll)
- ✅ EIP-712 authorization consumed on-chain by SelfEligibilityPolicy
- ✅ Negative tests: wrong account, replay, expiry, bypass

**How it differs from standard MACI:** Standard MACI uses a trusted operator to manage the eligibility list. VenekoVox replaces this with ZKPassport — the user's own passport proves eligibility, and the operator never sees the user's identity.

---

### The Graph (Indexing & Querying)

**What it does:** Indexes MACI on-chain events (voter registrations, poll metadata) into a standardized, queryable format. Enables public audit of participation counts, poll schedules, and (after tally) results.

**Evidence:**

- ✅ Subgraph deployed to Graph Studio (deployment `QmeBkGteYdc7bQeHD2FneLBG1dm5MHcMbvgYPiKxAfqDeM`)
- ✅ Indexed entities: StateLeaf (voter registrations), Poll metadata
- ✅ `hasIndexingErrors: false` — clean sync
- ✅ Studio endpoint: `https://api.studio.thegraph.com/query/1758839/venekovox-governance-v-2/wp4-state-leaves`
- ✅ Messari governance schema compatibility (v2 projection)

**Query examples:**

```
Q: how many registrations for poll X?   → Poll.registrationCount ✓
Q: how many encrypted messages?         → Poll.numMessages ✓
Q: when does the poll close?            → Poll.startDate/endDate ✓
Q: what were the results?               → TallyResult (after poll closes) ✓
```

---

### ENS (Poll Discovery)

**What it does:** Registers human-readable names for polls on ENS V2. Enables discovery via `superintelligence.polls.venekovoxv1.eth` — resolves to the on-chain poll address and metadata.

**Evidence:**

- ✅ VenekoVoxNames contract deployed: `0x870A12e8274A165C7bCa64B563aAaeD2655E8369`
- ✅ Poll 3 named: `superintelligence.polls.venekovoxv1.eth`
- ✅ Operator-only `namePoll(label, pollId)` function
- ✅ ENS V2 hierarchy: `venekovoxv1.eth` → `polls.venekovoxv1.eth` → `<label>.polls.venekovoxv1.eth`
- ✅ Frontend resolves poll names via ENS universal resolver

---

## The Differentiator

Standard voting systems (including most MACI deployments) rely on a trusted operator to manage eligibility. This creates a single point of trust and failure.

VenekoVox replaces this with **ZKPassport** — the user's own government-issued document proves eligibility via zero-knowledge proofs. The operator never sees the user's identity, nationality, or personal data. The contract only sees a cryptographic proof that the user is eligible.

This is not a cosmetic integration — it fundamentally changes the trust model:

| Standard MACI                     | VenekoVox                                        |
| --------------------------------- | ------------------------------------------------ |
| Operator manages eligibility list | User's passport proves eligibility               |
| Operator sees who's eligible      | Operator sees nothing                            |
| Single point of trust             | Distributed trust (passport issuer + ZKPassport) |
| Requires pre-registration         | Self-service verification                        |

---

## Honest Limitations

- **Testnet only.** All contracts are on Sepolia. Mainnet deployment is a future milestone.
- **Single coordinator.** The MACI coordinator is a single operator. Distributed coordination is a Stage 3 goal.
- **Demo poll.** The flagship poll is a demonstration, not a statistically representative survey.
- **Nationality not gated.** The flagship poll accepts any passport (age 18+). Stage 2 adds opt-in demographic breakdowns.
- **No vote buying protection at the UI level.** MACI protects against on-chain vote buying, but a coercer could still watch the screen.

---

## Repository

- **[Product Journey](journey.md)** — Architecture, trust boundaries, design rationale
- **[As-Built Map](journey-map.md)** — Call-by-call ASCII map of every contract hop
- **[Status & Evidence](status.md)** — Ground-truth implementation state
- **[Roadmap](roadmap.md)** — Phased milestones, gates, and decisions
- **[Build & Runbook](build.md)** — Development setup and deployment
