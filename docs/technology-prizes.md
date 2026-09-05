# Technologies and prize alignment

Prize pages checked on **2026-09-05**. Recheck before submission; simultaneous category eligibility/stacking is not established here. Prize fit never replaces the [product acceptance gates](roadmap.md).

| Technology                        | Product role                                      | Implementation responsibility                              | Prize relationship                                                   |
| --------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| Self Pass                         | Eligibility proof                                 | QR/verifier plus missing P2 contract authorization         | Core product foundation; no award assumed here                       |
| MACI                              | Encrypted commands and verifiable aggregate tally | P1/P2/P4, coordinator operation and privacy disclosure     | Core/upstream foundation; attribute reused code                      |
| Privy / smart account / paymaster | Low-friction onboarding and sponsored execution   | W1 adapter, caller binding, receipt and failure handling   | Product requirement; provider/award not assumed                      |
| ENSv2                             | Persistent names and profile navigation           | E1 real Sepolia registration/resolution and recovery rules | ENS continuity opportunity                                           |
| The Graph                         | Public poll/result read model                     | P4 result integrity, T4 schema, T5 live indexing           | Standardization/composition and AI continuity opportunities          |
| Messari schema                    | Reusable governance data conventions              | T4 explicit privacy/semantic extension                     | Evidence for Graph standardization, not a separate integration award |
| MCP / agent layer                 | Natural-language access to public results         | T6 meaningful live queries with source evidence            | Graph AI continuity                                                  |
| x402 + Bazantic                   | Controlled agent access/creation                  | A1 gateway, Recipe, idempotency and measured comparison    | Bazantic continuity opportunity                                      |

## The Graph

The [official page](https://ethglobal.com/events/ethonline2026/prizes/the-graph) lists separate standardization/composition and AI Continuity categories, each a $5,000 pool split into $2,500/$1,500/$1,000 awards. The separate AI Scratch category is not our continuity target. Standardized schema work or composition must power meaningful live-data functionality. AI work must meaningfully use live Graph data and explain pre-existing work. Prepare a public repository and the requested 2–4 minute demonstration. Do not claim that all $15,000 is available to this project, that merely adding an MCP client qualifies, or that multiple awards may be stacked without checking.

Our evidence: schema diff and semantic compatibility note; deployed endpoint; useful query and UI output; agent answer grounded in that output; clear pre-event/event work boundary. These artifacts are still pending unless linked in the judge evidence table.

## ENS

The [official page](https://ethglobal.com/events/ethonline2026/prizes/ens) requires meaningful ENSv2 use on Sepolia, with working code and demonstration. It lists a $500 continuity category separately from the $4,500 open category. Hardcoded names or cosmetic display do not establish integration. Demonstrate real registration/resolution, fallback behavior and how the name improves the participant journey. Confirm category eligibility before applying; naming does not replace Self or MACI authorization.

## Bazantic

The [official page](https://ethglobal.com/events/ethonline2026/prizes/bazantic) lists a $1,000 continuity pool with up to two $500 awards. It requires actual Bazantic gateway/Recipe use and a controlled comparison: the same task, model, settings and API access, with the Recipe as the material difference. Preserve inputs/results, demonstration and account details requested by the sponsor. A standalone x402 endpoint or recipe-style document does not by itself satisfy the integration requirement.

## Scope discipline

Chainlink and other earlier brainstormed integrations are outside the current critical path. Revisit only with a concrete product need and freshly verified sponsor requirements; old access/waitlist notes are not current evidence. Prioritize a complete working poll over accumulating unfinished sponsor logos.
