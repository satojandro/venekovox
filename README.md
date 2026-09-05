# VenekoVox

**Civic polling for verified people, with private ballot submission and verifiable aggregate results.**

Alejandro started VenekoVox after growing up in Venezuela and experiencing how little voice people can have in public decisions. The product aims to make participation easy: understand an issue, establish eligibility, submit a private preference, and return to inspect the results.

This is an ETHOnline 2026 **Continuity** project built on earlier VenekoVox work and upstream MACI. It is under development; the complete verified-human-to-verified-results journey has not yet passed an end-to-end acceptance test. Poll results describe participants, not a statistically representative population.

## Start here

- **Product and engineering:** [documentation index](docs/README.md), [vision](docs/product-vision.md), [architecture](docs/architecture.md).
- **Continue implementation:** [current state](docs/current-state.md), [roadmap](docs/roadmap.md), [agent handoff](docs/agent-handoff.md).
- **Evaluate the project:** [judge guide](docs/judges.md), [technology and prize mapping](docs/technology-prizes.md).
- **Run the project:** [development and demo runbook](docs/runbook.md).

## How the parts fit

| Component                              | Product responsibility                                            | State at the reviewed commit                                                  |
| -------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Self Pass                              | Prove eligibility from a supported identity document              | QR and backend verifier exist; authorization into MACI is missing             |
| MACI                                   | Encrypted voting commands and proof-verified tally infrastructure | Signup/join/publish wired; live complete tally journey unverified             |
| Smart wallet and sponsorship           | Remove wallet installation and gas funding friction               | Planned; Privy is a candidate                                                 |
| ENS                                    | Persistent human-readable profile and navigation                  | Planned; not personhood verification                                          |
| The Graph and a Messari-derived schema | Searchable, comparable public poll data and aggregates            | Native event mappings exist; standardized schema and results pipeline pending |
| Agents and paid creation               | Query results and propose or create timely polls                  | Downstream, planned                                                           |

MACI does not guarantee that nobody can associate a ballot with a person. The coordinator decrypts voting commands; chain metadata, identity-service disclosures and public profiles require explicit privacy boundaries. Read the [trust model](docs/architecture.md) before writing privacy claims.

## Repository

`apps/front-end` contains the React UI and browser voting flow; `apps/backend` contains the Self verifier; `apps/subgraph` contains indexing sources. `packages/contracts`, `packages/sdk`, and other MACI packages supply the underlying protocol/tooling. See [source-to-feature mapping](docs/current-state.md).

The documentation review is anchored to `7fce1e185a2d24a38e20a56bb99f900a07df2cef` on 2026-09-05. Subsequent work must update the evidence and status tables, not silently reinterpret this snapshot.
