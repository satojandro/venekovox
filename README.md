# VenekoVox

**Civic polling for verified people, with private ballot submission and verifiable aggregate results.**

Alejandro started VenekoVox after growing up in Venezuela and experiencing how little
voice people can have in public decisions. The product aims to make participation easy:
understand an issue, establish eligibility, submit a private preference, and return to
inspect the results.

This is an ETHOnline 2026 **Continuity** project built on earlier VenekoVox work and
upstream MACI. It is under development; the complete verified-human-to-verified-results
journey has not yet passed an end-to-end acceptance test. Poll results describe
participants, not a statistically representative population.

## Start here

- **[Technical journey map](docs/journey-map.md)** — call-by-call ASCII map of what each technology does and when it enters. Start here.
- **Product and engineering:** [documentation index](docs/README.md), [journey and architecture](docs/journey.md).
- **Continue implementation:** [status](docs/status.md), [roadmap](docs/roadmap.md), [build and runbook](docs/build.md).
- **Evaluate the project:** [technology and judge guide](docs/technology.md).

## How the parts fit

| Component                              | Product responsibility                                            | State at the reviewed commit                                                  |
| -------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Self Enterprise (migration)            | Prove eligibility from a supported identity document              | Legacy Pass UI remains; Enterprise/P2 candidate is unmounted                  |
| MACI                                   | Encrypted voting commands and proof-verified tally infrastructure | Signup/join/publish wired; live complete tally journey unverified             |
| Smart wallet and sponsorship           | Remove wallet installation and gas funding friction               | Planned; Privy is a candidate                                                 |
| ENS                                    | Persistent human-readable profile and navigation                  | Planned; not personhood verification                                          |
| The Graph and a Messari-derived schema | Searchable, comparable public poll data and aggregates            | Native event mappings exist; standardized schema and results pipeline pending |
| Agents and paid creation               | Query results and propose or create timely polls                  | Downstream, planned                                                           |

MACI does not guarantee that nobody can associate a ballot with a person. The
coordinator decrypts voting commands; chain metadata, identity-service disclosures and
public profiles require explicit privacy boundaries. Read the
[trust model](docs/journey.md) before writing privacy claims.

## Repository

`apps/front-end` contains the React UI and browser voting flow; `apps/backend` contains
the Self verifier; `apps/subgraph` contains indexing sources. `packages/contracts`,
`packages/sdk`, and other MACI packages supply the underlying protocol/tooling. See the
[source-to-feature mapping](docs/status.md).

The documentation review is anchored to `05d8f2a35` on 2026-09-05. Subsequent work must
update the evidence and status tables, not silently reinterpret this snapshot.
