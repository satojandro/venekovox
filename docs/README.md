# VenekoVox — Private, Verifiable Civic Polling for Real Humans

**One honest opinion, zero consequences. That's the product.**

VenekoVox is a zero-knowledge civic polling platform: verified humans express genuine opinions without fear of retaliation, and anyone can audit the results. A poll's outcome is a measurement of what people actually believe when belief is safe to express — not what a vocal minority, a bot farm, or a state apparatus produces.

---

## Why this exists

The failure mode is identical everywhere, only the coercer changes:

| Context                                   | What happens to honest sentiment                                                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **State repression** (Venezuela)          | Elections are manipulated; dissent is punished; official results and independent polls can't be trusted or even safely collected.                          |
| **Social pressure** (Western democracies) | Cancel culture and peer pressure penalize honest opinions; the silent majority self-censors; a vocal minority dictates the narrative.                      |
| **Epistemic breakdown**                   | Polling has failed across consecutive political cycles; social media is weaponized by bot farms and AI personas; leaders govern by manufactured consensus. |

The result is the same: people hide real beliefs → public discourse rots → manufactured narratives fill the void. VenekoVox replaces manufactured consensus with **ground-truth conviction**: real people, real conviction, zero negative consequences.

This is not a hackathon throwaway. It is a product we intend to keep building after this event — the post-hackathon plan is in [roadmap.md](roadmap.md).

---

## The stack, in one paragraph

A voter scans their passport on their own device — **ZKPassport** generates a zero-knowledge proof that they are a real human (18+, facematch against the issuing state's chip photo) without revealing name, nationality, or any personal data. Their ballot is encrypted to the coordinator and published through **MACI** (Minimal Anti-Collusion Infrastructure), which makes it mathematically impossible to prove how anyone voted — even to a briber standing over their shoulder, because votes can be re-cast invisibly. A custom **The Graph** subgraph indexes registrations, poll schedules, and results into standardized, queryable governance data, so participation and outcomes are publicly auditable. Polls get human-readable names through **ENSv2** (`superintelligence.polls.venekovoxv1.eth`) via a dedicated subname registry, making every poll a discoverable, shareable on-chain object.

**The key integration is the trust-model change:** standard MACI deployments use a trusted operator to manage the eligibility list. VenekoVox replaces that operator with the voter's own passport — eligibility is proven by zero-knowledge proof, the operator never sees identity data, and there is no pre-registration gate to trust or attack. Details in [technology.md](technology.md).

---

## Verified live state (checked 2026-09-13)

All claims below were re-verified against live endpoints on submission day — not copied from earlier docs.

- **Flagship poll is open now:** Poll 3 on Sepolia, voting window Sep 13 09:34 UTC → Sep 14 09:34 UTC.
- **Contracts live on Sepolia** (chainId 11155111) with verified bytecode presence: MACI `0x44F3…3Fe3a`, Poll 3 `0x604a…6562`, Tally 3 `0x25c0…21D6`, SelfEligibilityPolicy `0x7Bb4…b902`, VenekoVoxNames `0x870A…8369` — full addresses in [technology.md](technology.md).
- **The Graph subgraph is live:** queries against the Studio endpoint return clean sync (`hasIndexingErrors: false`), with all four polls indexed including the flagship, and StateLeaf entities tracking registrations.
- **End-to-end flow demonstrated:** verify → join → encrypted vote → close → proof-verified tally, exercised with a real passport session on Sep 11 (see [technology.md](technology.md) for evidence per technology).

Run it yourself: the product journey is **claim an ENS name → verify with your passport → join the poll → cast an encrypted vote → get a receipt → see proof-verified results**. Front-end: `openpoll.xyz` (product domain) with `app.uxisnear.com` retained as the ZKPassport-validated origin.

---

## Prize track mapping (sponsor language, our usage)

### The Graph — Best Use of Composable or Standardized Graph Products

> Qualification: "build meaningfully on a standardized schema (for example the Messari Standardized Subgraphs)" and "Consume live data from a Graph provider."

**What we did:** VenekoVox indexes MACI — an archived, private-voting protocol whose public surface was never standardized — into a subgraph aligned with the **Messari governance schema** (the standardized schema the track names explicitly). One query pattern (`Poll`, `StateLeaf`, `TallyResult` entities) answers registration counts, message counts, schedules, and post-tally results; the same query shape generalizes to any MACI-style governance deployment. Live consumption from Subgraph Studio (verified above), not mocked data. Novel angle: we extend the standardized governance schema to a **privacy-preserving protocol** — where standard schemas index _who_ voted, ours indexes _that_ eligibility-proven voters exist and _what the proof-verified tally says_, never the ballot. Write-up: [blog/2026-09-07-maci-messari-governance-schema.md](blog/2026-09-07-maci-messari-governance-schema.md).

### ENS — Best Use of ENSv2

> Qualification: "Project must be built on ENSv2 (Sepolia). ENSv2 features should be central to the product, not a cosmetic add-on."

**What we did:** ENSv2 is the **discovery layer of the product itself**, not a profile sticker. We deployed our own ENSv2 subname registry (`VenekoVoxNames` on Sepolia) so every poll is a named, on-chain object: `venekovoxv1.eth` → `polls.venekovoxv1.eth` → `superintelligence.polls.venekovoxv1.eth`. The hierarchy uses ENSv2's new registry structure — the subname registry is ours, managed under our rules, with wildcard resolution through the universal resolver; the front-end resolves poll names live via ENS resolution. Novel angle: a poll's name is its **address, its brand, and its share-link** — civic infrastructure named like the civic objects it is. Evidence: [ens-deployment.md](ens-deployment.md), [ens-registration.md](ens-registration.md).

### MACI + ZKPassport — the core technology story (not prize tracks; the reason the product works)

MACI's upstream repository (`privacy-ethereum/maci`) was **archived on Aug 19, 2026**. We deployed it, integrated it with ZKPassport eligibility, and shipped a complete verify → join → vote → tally journey _after_ that archive date — an active deployment of an archived protocol, extended with a modern on-device identity proof. That combination is the differentiator no off-the-shelf stack gives you, and it is why we're confident continuing to build: the pieces are public, auditable, and ours to extend.

---

## Documentation map

Judge-focused:

- [technology.md](technology.md) — technology → evidence per sponsor track, verified
- [journey.md](journey.md) — product journey, architecture, trust boundaries
- [roadmap.md](roadmap.md) — post-hackathon product plan (this keeps going)
- [flagship-poll-manifest.md](flagship-poll-manifest.md) — the flagship poll's question, options, eligibility
- [blog/](blog/) — publishable write-ups, incl. the Messari governance schema design

Builder/agent records (how it was built, handoffs, runbooks):

- [archive/](archive/) — build specs, runbooks, agent handoffs, status/evidence ledgers (kept for provenance; [archive/status.md](archive/status.md) remains the implementation-truth ledger). Screen-by-screen map: [archive/journey-map.md](archive/journey-map.md#frontend-routes-overlay--2026-09-13).

Design assets: [design/](design/) — editorial collages and mockups behind the current front-end.

---

## Repository

Monorepo: `apps/front-end` (React/Vite), `apps/backend` (eligibility + indexed-tree services), `apps/coordinator` (MACI operator tooling), `apps/subgraph` (The Graph), `packages/contracts` (incl. VenekoVoxNames ENSv2 registry).

Run: `pnpm install && pnpm build`. Front-end tests: `pnpm --dir apps/front-end test:unit` (122/122 passing at last full run, Sep 13).
