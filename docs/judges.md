# Judge guide

## What we are building

VenekoVox aims to let verified people participate in civic polls through private ballot submission and inspectable aggregate results. The project grew from Alejandro's experience of limited civic voice in Venezuela. It is a Continuity entry built on prior VenekoVox work and upstream MACI.

The product combines document-derived eligibility, contract-enforced participation, encrypted voting and a public results layer. ENS improves recognition and navigation. Smart wallets and sponsorship reduce onboarding friction. Agents are a later interface to the same public data and controlled creation service.

**Current limitation:** the complete human-verification-to-final-results journey is not yet demonstrated at the reviewed baseline. The UI still contains mock poll data. See [current state](current-state.md) for exact implementation and evidence boundaries.

## Intended demonstration

1. Explain the poll, who qualifies, and what is public/private.
2. Verify eligibility and show that direct unauthorized participation is rejected.
3. Submit an encrypted command, inspect its transaction, refresh and recover correct state.
4. Close/process the poll and show verified aggregate results with chain and indexer provenance.
5. If completed, show ENS navigation, zero-ETH onboarding, a useful cross-protocol query and an agent answer grounded in live results.

Only demonstrate implemented steps as working. Label fixtures/staging. A submitted command is not yet a counted vote; the coordinator can decrypt MACI commands; these results describe participants rather than a representative population.

## Evidence to attach before submission

| Artifact                                                          | Status at documentation review   |
| ----------------------------------------------------------------- | -------------------------------- |
| Demo URL and exact release commit                                 | Not recorded                     |
| Verified public deployment manifest, selected poll and policy     | Pending fresh-poll verification  |
| Eligible and rejected eligibility demonstrations                  | Pending                          |
| Submission tx, refresh recovery recording                         | Complete live acceptance pending |
| Verified tally proof/result evidence and live Graph query         | Pending                          |
| Standardized-schema diff, reference dataset and comparative query | Pending                          |
| ENSv2 registry/resolver/name evidence                             | Pending                          |
| Zero-ETH journey and sponsorship evidence                         | Pending                          |
| Agent baseline/Recipe comparison and source-grounded answer       | Pending                          |
| Final video and event-period attribution                          | Pending                          |

## Continuity attribution

The repository includes substantial upstream MACI protocol/packages, an earlier 2025 VenekoVox project, and August 2026 revival work. September commits reviewed here include reliable vote-flow integration, hydration/receipt work and architecture documentation. Git timestamps alone do not establish organizer eligibility. Confirm the official event boundary, identify the pre-event baseline SHA, and list only eligible-period contributions as this hackathon's work.

Do not claim the MACI protocol, Messari base schema or sponsor SDKs were authored by this team. Explain the new product integration and extensions with commit links. [Prize map](technology-prizes.md) connects each sponsor target to concrete evidence; [architecture](architecture.md) explains how the system fits together.
