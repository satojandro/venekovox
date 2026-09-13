# VenekoVox

**Private, Verifiable Civic Polling for Real Humans.**

VenekoVox is a zero-knowledge polling platform that lets verified people express their genuine opinions without fear of retaliation. Whether under authoritarian repression or social peer pressure, the failure mode is identical: people hide their real beliefs, public discourse rots, and manufactured narratives fill the void.

VenekoVox replaces manufactured consensus with ground-truth conviction: **Real people. Real conviction. Zero negative consequences.**

---

## The Problem

1. **State Repression (Venezuela):** Official elections are manipulated, and dissent carries high personal cost. Citizens have no secure, verifiable way to demonstrate real collective sentiment.
2. **Social Pressure (Western Democracies):** Cancel culture and peer pressure penalize honest opinions. The silent majority self-censors, leaving a vocal minority to dictate the narrative.
3. **Epistemic Breakdown:** Traditional polling has failed across consecutive political cycles. Social media is weaponized by bot farms and AI personas. Leaders govern by manufactured consensus.

---

## How It Works

```
┌───────────────────────┐     ┌───────────────────────┐     ┌───────────────────────┐
│     ZKPASSPORT        │     │       MACI            │     │      THE GRAPH        │
│  (ZK Identity Proof)  │     │  (Anti-Coercion)      │     │  (Auditable Results)  │
├───────────────────────┤     ├───────────────────────┤     ├───────────────────────┤
│ Proves you are a real │ ──> │ Encrypts your vote    │ ──> │ Indexes standardized  │
│ human (passport scan, │     │ so no one — not even  │     │ governance data for   │
│ age 18+, verified)    │     │ the operator — can    │     │ global public audit.  │
│ without revealing     │     │ prove how you voted.  │     │                       │
│ your identity.        │     │                       │     │                       │
└───────────────────────┘     └───────────────────────┘     └───────────────────────┘
```

### The Journey (as a voter)

1. **Open a poll.** Read the question, options, eligibility, and schedule.
2. **Scan your passport.** ZKPassport verifies you're a real human (age 18+, facematch) without revealing your name, nationality, or personal data.
3. **Vote privately.** Your ballot is encrypted before it leaves your device. MACI's zero-knowledge proofs make it mathematically impossible to prove how you voted — even if someone looks over your shoulder.
4. **Results are verifiable.** After the poll closes, a ZK-SNARK tally proves the aggregate result without exposing individual ballots.

### Why MACI?

MACI (Minimum Anti-Collusion Infrastructure) is the key differentiator. Unlike traditional voting systems:

- **Vote buying is impossible.** A voter cannot prove how they voted to a third party.
- **Coercion is neutralized.** Even if forced to vote a certain way, a voter can change their vote without the coercer knowing.
- **The tally is verifiable.** Anyone can verify the ZK proof that the announced result matches the encrypted ballots.

---

## Live Demo

**Flagship Poll:** "Should development of superintelligence be paused?"

- **Options:** Yes, pause it / No, keep going / Unsure
- **Eligibility:** Real passport (ZKPassport), age 18+, one vote per person
- **Network:** Ethereum Sepolia testnet
- **Live at:** [app.uxisnear.com](https://app.uxisnear.com)

### Deployed Contracts (Sepolia)

| Contract                | Address                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| MACI                    | [`0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`](https://sepolia.etherscan.io/address/0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a) |
| Poll 3 (Flagship)       | [`0x604a8a64787659FEc944bE4aa407bA8805C46562`](https://sepolia.etherscan.io/address/0x604a8a64787659FEc944bE4aa407bA8805C46562) |
| Tally 3                 | [`0x25c02FA61C4a34d8E3F97A7893216843F14621D6`](https://sepolia.etherscan.io/address/0x25c02FA61C4a34d8E3F97A7893216843F14621D6) |
| SelfEligibilityPolicy 3 | [`0x7Bb4ff758816d621e1e30191a7D496EFC38eb902`](https://sepolia.etherscan.io/address/0x7Bb4ff758816d621e1e30191a7D496EFC38eb902) |
| VenekoVoxNames (ENS)    | [`0x870A12e8274A165C7bCa64B563aAaeD2655E8369`](https://sepolia.etherscan.io/address/0x870A12e8274A165C7bCa64B563aAaeD2655E8369) |

### ENS Integration

Polls are named on-chain via ENS V2:

- `superintelligence.polls.venekovoxv1.eth` → Poll 3
- Human-readable poll discovery via ENS resolution

### Subgraph (The Graph)

- **Studio endpoint:** `https://api.studio.thegraph.com/query/1758839/venekovox-governance-v-2/wp4-state-leaves`
- **Indexed entities:** StateLeaf (voter registrations), Poll metadata
- **Tally indexing:** After poll closes, tally results are indexed on-chain and queryable

---

## Prize Integrations

| Prize Track    | Integration                                                         | Status                          |
| -------------- | ------------------------------------------------------------------- | ------------------------------- |
| **MACI**       | Core voting infrastructure; encrypted ballots, ZK tally             | ✅ Live end-to-end              |
| **ZKPassport** | Identity verification (real passport, salted uniqueness, facematch) | ✅ Real-document session passed |
| **The Graph**  | Subgraph indexing MACI events; standardized governance schema       | ✅ Deployed to Studio           |
| **ENS**        | Poll naming via ENS V2 (`polls.venekovoxv1.eth`)                    | ✅ Poll names registered        |

---

## Repository Structure

```
venekovox/
├── apps/
│   ├── front-end/          # React + Vite (poll UI, voting flow)
│   ├── backend/            # Eligibility service, Graph proxy
│   ├── subgraph/           # The Graph subgraph definitions
│   └── coordinator/        # Tally coordinator scripts
├── packages/
│   ├── contracts/          # Solidity (MACI policies, ENS, deploy)
│   ├── sdk/                # TypeScript SDK
│   ├── domainobjs/         # MACI domain objects
│   ├── crypto/             # ZK crypto primitives
│   └── cli/                # CLI tools
└── docs/
    ├── journey.md          # Product architecture & design rationale
    ├── journey-map.md      # Call-by-call as-built ASCII map
    ├── status.md           # Ground-truth implementation state
    ├── roadmap.md          # Phased milestones & gates
    ├── technology.md       # Prize track mapping for judges
    └── build.md            # Development setup & runbook
```

---

## The Vision: From Polling to Civic Pulse

VenekoVox is not a one-off voting tool — it's designed as an enduring infrastructure for collective intelligence:

### Stage 1: Private Verifiable Polling (Current)

- Real-document eligibility (ZKPassport)
- Encrypted ballot submission (MACI)
- Verified aggregate results (ZK-SNARK tally)
- ENS poll discovery

### Stage 2: Rich Demographic Results

- Age, gender, and geographic breakdowns (opt-in REVEALs)
- Longitudinal sentiment tracking (Civic Pulse)
- Cross-poll analytics and trend detection

### Stage 3: Reduce Single-Operator Trust

- Distributed coordinator infrastructure
- Participant-held credentials
- Contract-verifiable eligibility
- Independent operator federation

### Stage 4: Informed Community

- AI-grounded discourse (balanced context per poll)
- Agent-accessible results (MCP/LLM integration)
- Controlled creation API (x402 payments)
- Polymarket of public sentiment

---

## Development

```bash
# Prerequisites
node >=22 <23
pnpm install

# Run locally
cd apps/backend && pnpm dev     # Backend (port 3100)
cd apps/front-end && pnpm dev   # Frontend (port 3000)

# Deploy contracts
cd packages/contracts
pnpm deploy-poll:sepolia        # Deploy a new poll

# Run tests
pnpm test                       # Unit tests
pnpm test:e2e                   # End-to-end tests
```

---

## Documentation

- **[Product Journey](docs/journey.md)** — Architecture, trust boundaries, design rationale
- **[As-Built Map](docs/journey-map.md)** — Call-by-call ASCII map of every contract hop
- **[Status & Evidence](docs/status.md)** — Ground-truth implementation state
- **[Roadmap](docs/roadmap.md)** — Phased milestones, gates, and decisions
- **[Judge Guide](docs/technology.md)** — Prize track mapping and evidence
- **[Build & Runbook](docs/build.md)** — Development setup and deployment

---

## License

Built during ETHOnline 2026 on top of [MACI](https://github.com/privacy-scaling-explorations/maci) (PSE) and [ZKPassport](https://zkpassport.id).
