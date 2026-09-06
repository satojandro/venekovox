# Technologies and judge guide

Prize pages checked on **2026-09-05**. Recheck before submission; simultaneous
category eligibility/stacking is not established here. Prize fit never replaces the
[product acceptance gates](roadmap.md).

## 1. What we are building

VenekoVox aims to let verified people participate in civic polls through private
ballot submission and inspectable aggregate results. The project grew from Alejandro's
experience of limited civic voice in Venezuela. It is a Continuity entry built on
prior VenekoVox work and upstream MACI.

The product combines document-derived eligibility, contract-enforced participation,
encrypted voting and a public results layer. ENS improves recognition and navigation.
Smart wallets and sponsorship reduce onboarding friction. Agents are a later interface
to the same public data and controlled creation service.

**Current limitation:** the complete human-verification-to-final-results journey is
not yet demonstrated at the reviewed baseline. The UI still contains mock poll data.
See [status.md](status.md) for exact implementation and evidence boundaries, and
[journey-map.md](journey-map.md) for the call-by-call truth.

## 2. Technology → stage → prize → evidence

| Technology                        | Stage of the journey    | Product role                                      | Prize relationship                                                   | Evidence today                                                 |
| --------------------------------- | ----------------------- | ------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| MACI                              | 3 vote, 4 count         | Encrypted commands and verifiable aggregate tally | Core/upstream foundation; attribute reused code                      | 52 unit tests; **no live tally**                               |
| Self Enterprise (migration)       | 2 prove eligibility     | Eligibility proof                                 | Core product foundation; no award assumed                            | Legacy route active; Enterprise candidate unmounted (G01 open) |
| The Graph                         | 5 inspect               | Public poll/result read model                     | Standardization/composition and AI continuity opportunities          | Mappings exist; live deployment/query evidence pending         |
| Messari schema                    | 5 inspect               | Reusable governance data conventions              | Evidence for Graph standardization, not a separate integration award | Not started                                                    |
| ENSv2                             | 1 understand, 5 inspect | Persistent names and profile navigation           | ENS continuity opportunity                                           | **No code in repo**                                            |
| Privy / smart account / paymaster | 2–3 onboard, vote       | Low-friction onboarding and sponsored execution   | Product requirement; provider/award not assumed                      | Separate W1 experiment branch; gates open                      |
| MCP / agent layer                 | 5 inspect               | Natural-language access to public results         | Graph AI continuity                                                  | Not started                                                    |
| x402 + Bazantic                   | 5 (agent creation)      | Controlled agent access/creation                  | Bazantic continuity opportunity                                      | Not started                                                    |

### The honest one-liner per technology

```
  MACI        encrypts ballots to a coordinator, proves the aggregate with zk
  Self        proves a real passport, one person — but the CONTRACT never hears it
  The Graph   indexes MACI event logs — counts turnout, CANNOT see results
  Tally.sol   verifies the count on-chain — emits NO events, so results stop here
  ENS         naming only; zero code today
  Privy/7702  would change which address calls every contract; zero code today
```

## 3. The Graph

The [official page](https://ethglobal.com/events/ethonline2026/prizes/the-graph) lists
separate standardization/composition and AI Continuity categories, each a $5,000 pool
split into $2,500/$1,500/$1,000 awards. The separate AI Scratch category is not our
continuity target. Standardized schema work or composition must power meaningful
live-data functionality. AI work must meaningfully use live Graph data and explain
pre-existing work. Prepare a public repository and the requested 2–4 minute
demonstration. Do not claim that all $15,000 is available to this project, that merely
adding an MCP client qualifies, or that multiple awards may be stacked without checking.

**What the source model supports** (live verification pending):

```
  Q: how many registrations for poll X?   A: Poll.registrationCount   ✓ source
  Q: how many encrypted messages?     A: Poll.numMessages         ✓ source
  Q: when does the poll close?        A: Poll.startDate/endDate   ✓ source
  Q: what were the results?           A: ✗ NOT IMPLEMENTED (G06)
```

**The proposed pitch:** auditable participation counts, encrypted ballot choices,
and explicit privacy/finality semantics. Registrations are public-key-linked;
they are not proof of anonymous or unique-human participation. The schema
extension remains proposed. Live claims require a deployment version, endpoint,
indexed block and saved query response in [status.md](status.md).

Our evidence still to produce: schema diff and semantic compatibility note; deployed
endpoint; useful query and UI output; agent answer grounded in that output; clear
pre-event/event work boundary.

## 4. ENS

The [official page](https://ethglobal.com/events/ethonline2026/prizes/ens) requires
meaningful ENSv2 use on Sepolia, with working code and demonstration. It lists a $500
continuity category separately from the $4,500 open category. Hardcoded names or
cosmetic display do not establish integration. Demonstrate real
registration/resolution, fallback behavior and how the name improves the participant
journey. Confirm category eligibility before applying; naming does not replace Self or
MACI authorization.

**Status: no ENS code exists in this repository.** See [journey-map.md §5](journey-map.md).

## 5. Bazantic

The [official page](https://ethglobal.com/events/ethonline2026/prizes/bazantic) lists a
$1,000 continuity pool with up to two $500 awards. It requires actual Bazantic
gateway/Recipe use and a controlled comparison: the same task, model, settings and API
access, with the Recipe as the material difference. Preserve inputs/results,
demonstration and account details requested by the sponsor. A standalone x402 endpoint
or recipe-style document does not by itself satisfy the integration requirement.

## 6. Scope discipline

Chainlink and other earlier brainstormed integrations are outside the current critical
path. Revisit only with a concrete product need and freshly verified sponsor
requirements; old access/waitlist notes are not current evidence. Prioritize a complete
working poll over accumulating unfinished sponsor logos.

---

# Judge guide

## Intended demonstration

1. Explain the poll, who qualifies, and what is public/private.
2. Verify eligibility and show that direct unauthorized participation is rejected.
3. Submit an encrypted command, inspect its transaction, refresh and recover correct state.
4. Close/process the poll and show verified aggregate results with chain and indexer provenance.
5. If completed, show ENS navigation, zero-ETH onboarding, a useful cross-protocol query and an agent answer grounded in live results.

Only demonstrate implemented steps as working. Label fixtures/staging. A submitted
command is not yet a counted vote; the coordinator can decrypt MACI commands; these
results describe participants rather than a representative population.

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

The repository includes substantial upstream MACI protocol/packages, an earlier 2025
VenekoVox project, and August 2026 revival work. September commits reviewed here
include reliable vote-flow integration, hydration/receipt work and architecture
documentation. Git timestamps alone do not establish organizer eligibility. Confirm the
official event boundary, identify the pre-event baseline SHA, and list only
eligible-period contributions as this hackathon's work.

Do not claim the MACI protocol, Messari base schema or sponsor SDKs were authored by
this team. Explain the new product integration and extensions with commit links.
