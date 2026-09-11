# Documentation map

Read in this order.

| You are                                   | Read this                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Anyone, first time**                    | [journey-map.md](journey-map.md) — call-by-call ASCII map of what each technology does and when it enters     |
| Alejandro / product collaborator          | [journey.md](journey.md) → [journey-map.md](journey-map.md) → [roadmap.md](roadmap.md)                        |
| New implementation agent                  | [agents.md](agents.md) → [status.md](status.md) → [roadmap.md](roadmap.md) → [build.md](build.md)             |
| **Debugging or running the live journey** | [live-test-runbook.md](live-test-runbook.md) — topology, failure modes, diagnostic channel, recipes           |
| **Planning the wallet/sponsorship work**  | [privy-migration-analysis.md](privy-migration-analysis.md) — what breaks, what survives, what to decide first |
| Judge / evaluator                         | [technology.md](technology.md) → [journey-map.md](journey-map.md) → [status.md](status.md)                    |
| Operator / demo runner                    | [live-test-runbook.md](live-test-runbook.md) → [build.md](build.md) Part B → [status.md](status.md)           |

## The documents

| File                                                             | What it is                                                                                                                   |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [journey-map.md](journey-map.md)                                 | **Start here.** Call-by-call ASCII map of the system as built                                                                |
| [journey.md](journey.md)                                         | Product journey, architecture, trust boundaries, design rationale                                                            |
| [status.md](status.md)                                           | What exists, evidence ledger, gaps G01–G13                                                                                   |
| [roadmap.md](roadmap.md)                                         | Milestones M1–M4, task IDs S1–S5, decisions D01–D17                                                                          |
| [technology.md](technology.md)                                   | Technology → stage → prize → evidence, plus judge guide                                                                      |
| [build.md](build.md)                                             | Integration specs (Part A) and runbook (Part B)                                                                              |
| [product-mount.md](product-mount.md)                             | **C gate spec (Cursor handoff):** mount ZKPassport → app.ts + FE Auth → join gate bytes                                      |
| [agents.md](agents.md)                                           | Agent handoff protocol                                                                                                       |
| [demographic-analytics-spec.md](demographic-analytics-spec.md)   | Long-term product direction DA0–DA3; proposed, not built                                                                     |
| [data-and-tally-architecture.md](data-and-tally-architecture.md) | Concrete storage, processing, demographic binding and result-delivery architecture                                           |
| [live-test-runbook.md](live-test-runbook.md)                     | **Operational:** topology, the failure modes we actually hit, the diagnostic channel, CLI recipes, demo-day procedure        |
| [privy-migration-analysis.md](privy-migration-analysis.md)       | Replacing the injected EOA with a Privy embedded/sponsored wallet: what changes per layer, what breaks, what to decide first |
| [blog/](blog/)                                                   | **Publishable write-ups** (journal + lesson format, reusable for the website or a talk) — see below                          |

## Blog drafts (`docs/blog/`)

Reusable, self-contained write-ups. Short sections, plain claims, honest limits stated in the
same document as the claim.

| File                                                                                                    | What it covers                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-09-11-maci-state-tree-scaling.md](blog/2026-09-11-maci-state-tree-scaling.md)                     | **MACI scaling:** why a join costs ~2,300 `eth_getLogs` calls, why an indexer alone doesn't fix it, the incremental tree service, and how the client validates a served proof against the on-chain root instead of trusting the service |
| [2026-09-11-wallet-rpc-is-not-a-read-endpoint.md](blog/2026-09-11-wallet-rpc-is-not-a-read-endpoint.md) | **Debugging:** ethers v6 misreporting a JSON-RPC rate limit as `CALL_EXCEPTION / missing revert data`; selector-first diagnosis; instrumenting a client you cannot see                                                                  |
| [2026-09-07-maci-messari-governance-schema.md](blog/2026-09-07-maci-messari-governance-schema.md)       | **Schema:** what MACI stores publicly vs privately, what a subgraph should index for a private-voting protocol, and the Messari governance extension                                                                                    |

## Authority

- **Code and chain observations beat documentation.** If a doc disagrees with the repo, the doc is stale.
- [status.md](status.md) is the implementation-truth authority. [journey-map.md](journey-map.md) is the as-built structural authority.
- [roadmap.md](roadmap.md) sets gates and records decisions. A checked task needs evidence, not just a commit message.
- [build.md](build.md) Part A holds proposed contracts. Resolve open decisions before deploying contracts that bake them in.
- A new instruction from Alejandro supersedes any decision here. Record the change and reason.
- Demographic analytics is long-term product scope; its spec's existence does not claim implementation.

## Maintenance rule

[journey-map.md](journey-map.md) describes the code **as it is**, never as it will be.
The target product journey lives in [journey.md](journey.md#target-journey--proposed);
future technical contracts go in [build.md](build.md) Part A and migrate into the map only when the
code ships with a real file:line citation.

## Terms that must not be conflated

| Term          | Meaning                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| Verification  | Self proof accepted under a specified document/eligibility policy                       |
| Authorization | A contract-enforced permission to register or join                                      |
| Account       | Address that actually calls the contract; a smart account differs from its owner signer |
| MACI key      | Independent cryptographic voting key; not the wallet key or ENS name                    |
| Membership    | Registered in MACI and/or joined to a particular poll                                   |
| Submitted     | Encrypted command transaction successfully published                                    |
| Counted       | Reflected by the completed proof-verified tally under MACI rules                        |
| Receipt       | Evidence about a transaction; a cached hash alone is not chain confirmation             |
| ENS identity  | Public naming/profile layer; not proof of unique personhood                             |
| Messari       | A schema convention/source project, not an identity or privacy protocol                 |
| The Graph     | An indexed read model; not the authority that verifies eligibility or proves a tally    |
