# Documentation map

Read in this order.

| You are                          | Read this                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Anyone, first time**           | [journey-map.md](journey-map.md) — call-by-call ASCII map of what each technology does and when it enters |
| Alejandro / product collaborator | [journey.md](journey.md) → [journey-map.md](journey-map.md) → [roadmap.md](roadmap.md)                    |
| New implementation agent         | [agents.md](agents.md) → [status.md](status.md) → [roadmap.md](roadmap.md) → [build.md](build.md)         |
| Judge / evaluator                | [technology.md](technology.md) → [journey-map.md](journey-map.md) → [status.md](status.md)                |
| Operator / demo runner           | [build.md](build.md) Part B → [status.md](status.md)                                                      |

## The eight documents

| File                                                           | What it is                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| [journey-map.md](journey-map.md)                               | **Start here.** Call-by-call ASCII map of the system as built     |
| [journey.md](journey.md)                                       | Product journey, architecture, trust boundaries, design rationale |
| [status.md](status.md)                                         | What exists, evidence ledger, gaps G01–G13                        |
| [roadmap.md](roadmap.md)                                       | Milestones M1–M4, task IDs S1–S5, decisions D01–D16               |
| [technology.md](technology.md)                                 | Technology → stage → prize → evidence, plus judge guide           |
| [build.md](build.md)                                           | Integration specs (Part A) and runbook (Part B)                   |
| [agents.md](agents.md)                                         | Agent handoff protocol                                            |
| [demographic-analytics-spec.md](demographic-analytics-spec.md) | Long-term product direction DA0–DA3; proposed, not built          |
| [data-and-tally-architecture.md](data-and-tally-architecture.md) | Concrete storage, processing, demographic binding and result-delivery architecture |

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
