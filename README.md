# VenekoVox

**The Truth Layer for Civic Sentiment: Zero-Knowledge, Coercion-Resistant Polling for Real Humans.**

VenekoVox is built on a single conviction: **True civic expression cannot exist without absolute protection from retaliation.**

Whether under authoritarian repression where voting against the state invites violence and blacklists, or in Western democracies where the "silent majority" self-censors for fear of social cancellation and peer pressure, the failure mode is identical: people hide their real beliefs, public discourse rots, and manufactured narratives fill the void.

VenekoVox solves this by combining Zero-Knowledge identity proofs, anti-collusion cryptography, and decentralized indexing to create a neutral, un-fudgeable sentiment signal—the **Polymarket of public opinion**.

---

## The Crisis of Speech & Sentiment

1. **The State Threat (The Venezuelan Experience):**
   Official elections are manipulated, and dissent carries high personal cost. With regime popularity dropping below 10%, citizens have no secure, verifiable way to demonstrate real collective sentiment without risking their livelihoods or safety.
2. **The Social Threat (The Western / "Silent Majority" Experience):**
   In highly polarized environments, peer pressure and cancel culture penalize honest opinions. People self-censor, leaving a vocal minority to dictate the narrative while the silent majority remains unheard.
3. **The Epistemic Breakdown:**
   Traditional polling has failed across consecutive political cycles, sowing distrust in democratic outcomes. Meanwhile, social media is weaponized by synthetic bot farms, paid astroturfing, and AI personas. Leaders govern by manufactured consensus; citizens stop believing what their neighbors think.

VenekoVox restores ground truth: **Real people. Real conviction. Zero negative consequences.**

---

## How It Works

VenekoVox integrates three foundational primitives into a seamless civic journey:

```
  ┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
  │      SELF.XYZ         │     │       MACI            │     │      THE GRAPH        │
  │    (ZK Identity)      │     │  (Anti-Coercion)      │     │  (Auditable Results)  │
  ├───────────────────────┤     ├───────────────────────┤     ├───────────────────────┤
  │ Proves eligibility    │ ──> │ Encrypts vote ballots │ ──> │ Indexes standardized  │
  │ (nationality, age)    │     │ with coordinator ZK.  │     │ Messari governance    │
  │ without revealing IDs │     │ Impossible to prove   │     │ metrics for global    │
  │ or personal data.     │     │ choices to a coercer. │     │ public audit.         │
  └───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

- **Self Protocol (Identity without Doxxing):** Proves you are a unique, eligible human (e.g. Venezuelan passport, verified jurisdiction, adult age) without leaking your name, national ID, or biometric data on-chain.
- **MACI (Ballot Secrecy & Anti-Collusion):** Even if someone looks over your shoulder, demands a screenshot, or offers to buy your vote, MACI makes it mathematically impossible to prove how you voted. Retaliation is neutralized.
- **The Graph & Messari Standard:** Tally results are computed via ZK-SNARKs and indexed into standardized governance entities, making civic sentiment transparent, comparable, and auditable across protocols.
- **ENSv2 Discovery:** Human-readable civic spaces (`venezuela2026.eth`, `caracas-water.eth`) connect real-world communities directly to verifiable ballots.

---

## The Long-Term Vision: From Polling to Pulse

VenekoVox is not a one-off voting tool; it is designed as an enduring institution for collective intelligence:

- **The Civic Pulse:** Recurring, longitudinal sentiment tracking (e.g., weekly approval ratings, economic confidence, public health consensus) providing real-time societal telemetry.
- **Context & Resources Engine:** Balanced, sourced information panels attached to every poll—opposing policy briefs, historical context, and fact-checking.
- **Grounded Deliberation:** Community discussion lanes protected against bots, incorporating AI-driven synthesis (inspired by Grok on X) to summarize opposing arguments, expose false narratives, and illuminate genuine consensus.

---

## Repository & Documentation Map

- **[Technical Journey Map](docs/journey-map.md):** The definitive, call-by-call as-built ASCII map of every smart contract, SDK hop, and data flow.
- **[Product Architecture & Rationale](docs/journey.md):** Detailed explanation of the civic user journey, cryptographic dual-key model, and trust boundaries.
- **[Status & Evidence](docs/status.md):** Ground-truth implementation state, verified test outputs, and known gaps.
- **[Roadmap & Gates](docs/roadmap.md):** Phased milestones (M1–M4), gate ordering, and active decisions.
- **[Technology & Prize Map](docs/technology.md):** Track-by-track mapping for ETHOnline 2026 judges.
- **[Build & Runbook](docs/build.md):** Development setup, test scripts, and deployment instructions.

---

## Development Status

Built during ETHOnline 2026 (Continuity Track) on top of upstream Privacy & Scaling Explorations (PSE) MACI and Self.xyz primitives.

- Monorepo managed with `pnpm` (Node `>=22 <23`).
- UI in `apps/front-end`, backend verification in `apps/backend`, subgraphs in `apps/subgraph`, and core zero-knowledge contracts in `packages/contracts`.
