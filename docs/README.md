# Documentation map

This directory separates **product intent**, **observed implementation**, and **proposed interfaces**. A design described here is not automatically implemented or verified.

| Reader                           | Reading order                                                                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Alejandro / product collaborator | [Vision](product-vision.md) → [architecture](architecture.md) → [design rationale](design-rationale.md) → [roadmap](roadmap.md)                |
| New implementation agent         | [Handoff](agent-handoff.md) → [current state](current-state.md) → [decisions](decisions.md) → relevant [integration spec](integration-spec.md) |
| Judge                            | [Judge guide](judges.md) → [technology/prize map](technology-prizes.md) → linked implementation/evidence                                       |
| Operator / demo runner           | [Runbook](runbook.md) → [current state](current-state.md) → [roadmap acceptance gates](roadmap.md)                                             |

## Authority and maintenance

- Product choices live in [decisions](decisions.md); a new instruction from Alejandro can supersede them. Record the change and reason.
- Implementation status, known defects, baseline and verification evidence live in [current state](current-state.md). Code and chain observations override stale status claims.
- Dependencies and completion gates live in [roadmap](roadmap.md). A checked task needs evidence, not just a commit message.
- Proposed technical contracts live in [integration spec](integration-spec.md). Resolve open decisions before deploying contracts that bake them in.
- W1 wallet experiment protocol and evidence log: [w1-experiment.md](w1-experiment.md), [w1-evidence.md](w1-evidence.md). Scaffold is not architecture approval.
- Demographic analytics is **in long-term product scope** ([spec](demographic-analytics-spec.md)); DA0 is an optional bounded demo inside the event, DA1+ follow after M1. It does not change the M1 gates, and its existence does not claim implementation.
- Root [AGENTS.md](../AGENTS.md) and [todo.md](../todo.md) point here. Uploaded planning notes and old deployment records are background; reconcile them against this index rather than following competing plans.

## Terms that must not be conflated

| Term          | Meaning                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| Verification  | Self proof accepted under a specified document/eligibility policy                          |
| Authorization | A contract-enforced permission to register or join                                         |
| Account       | Address that actually calls the contract; a smart account differs from its owner signer    |
| MACI key      | Independent cryptographic voting key; not the wallet key or ENS name                       |
| Membership    | Registered in MACI and/or joined to a particular poll                                      |
| Submitted     | Encrypted command transaction successfully included                                        |
| Counted       | Reflected by the completed proof-verified tally under MACI rules                           |
| Receipt       | Evidence about a transaction; a cached hash alone is not chain confirmation                |
| ENS identity  | Public naming/profile layer; not proof of unique personhood                                |
| Messari       | A schema convention/source project, not an identity or privacy protocol                    |
| The Graph     | An indexed read model; not the authority that verifies human eligibility or proves a tally |
