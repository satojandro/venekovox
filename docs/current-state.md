# Current state and evidence

**Reviewed:** 2026-09-05. **Code baseline:** `7fce1e185a2d24a38e20a56bb99f900a07df2cef` (main). This is a snapshot, not live deployment monitoring.

Status vocabulary: **implemented** = source exists; **locally checked** = listed command passed; **reported** = another agent supplied evidence not independently reproduced here; **live verified** requires chain/browser evidence; **planned** = no completed implementation claim.

## Source-to-feature map

| Area                         | Source                                                       | Observed state                                                                            |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Self UI                      | [Auth.tsx](../apps/front-end/src/pages/Auth.tsx)             | Self QR flow; success stores a browser flag                                               |
| Self backend                 | [verify.ts](../apps/backend/src/routes/verify.ts)            | Proof verification, age policy, disclosed output; no durable authorization bridge         |
| Vote transaction flow        | [voteFlow.ts](../apps/front-end/src/hooks/voteFlow.ts)       | Atomic signup → lookup/join → publish with captured context and session checks            |
| Wallet/hydration             | [useMaci.ts](../apps/front-end/src/hooks/useMaci.ts)         | Injected wallet; mount/event hydration; browser-global MACI key                           |
| Receipt cache                | [receipts.ts](../apps/front-end/src/lib/receipts.ts)         | Context-scoped hash/time persistence, not chain verification                              |
| Poll screen                  | [PollDetail.tsx](../apps/front-end/src/pages/PollDetail.tsx) | Real voting hook mixed with hardcoded poll/eligibility/result data                        |
| Creation                     | [CreatePoll.tsx](../apps/front-end/src/pages/CreatePoll.tsx) | UI submission toast, not contract deployment                                              |
| Contracts                    | [contracts package](../packages/contracts/README.md)         | MACI policy hooks and proof/tally machinery; Self integration not demonstrated            |
| Indexing                     | [subgraph directory](../apps/subgraph)                       | Native event schema/mappings, PollJoined support; no standardized v2 or tally data source |
| ENS / smart wallets / agents | [integration spec](integration-spec.md)                      | Planned; not implemented by this documentation change                                     |

## Documentation-review validation

This documentation-only change covers 18 Markdown files. Local file links resolve and the 19 targeted tests pass. Full workspace build/typecheck and the repository formatter were not rerun: dependencies are absent in this worktree. Mermaid diagrams were manually reviewed as source, not rendered here. No application/contracts/configuration code changed.

## Evidence ledger

| Evidence                                                        | Result and limit                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current flow and receipt tests                                  | Independently run: 19 passed, 0 failed. Command in [runbook](runbook.md). SDK/session/storage test doubles; not a browser or cryptographic smoke |
| `19c3bae08` integration                                         | Implementation agent reported frontend typecheck/Vite build, lint and workspace checks passing                                                   |
| `68f658cf` hydration slice                                      | Merged via `930fb47`; source reviewed here. Build status is not a live acceptance result                                                         |
| Poll-0 dates                                                    | Implementation agent reported `getStartAndEndDate()` = `(0,0)`. No independent RPC recheck in this documentation review                          |
| Complete Self → policy → vote → tally → UI                      | **Not demonstrated**                                                                                                                             |
| Studio endpoint / cross-protocol query / ENSv2 / sponsored vote | **No verified evidence recorded**                                                                                                                |

## Configured chain context

The [subgraph network config](../apps/subgraph/config/network.json) selects Sepolia and MACI `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`, with scan start block `11567000`. Poll-0 was reported as `0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB`, deployment block `11567347`. The scan start is not a proven exact deployment block.

Reported zero start/end dates mean that Poll-0 cannot be used for a current voting demo. This does not establish that every poll on the network is closed. Query the chosen deployment before replacing it. The local generated `deployed-contracts.json` is an operator artifact, not an independently verified canonical registry. The 2025 archival deployment record contains malformed addresses and must not drive configuration.

## Open gaps (stable IDs)

| ID  | Observed gap                                                                                                                                                                   | Required resolution / acceptance                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| G01 | Self success only sets a UI flag; no contract authorization or durable uniqueness bridge                                                                                       | P2 policy enforcement and replay/binding tests; direct contract bypass must fail                              |
| G02 | Hydration loads stored hash/time without querying receipt or matching poll events                                                                                              | Check chain status and expected publish context before “confirmed”; see [receipt spec](hydration-receipts.md) |
| G03 | Hydration starts with unguarded resets; no configured-chain check before lookup; `peekWallet` conflates errors with disconnection; early hydration marker can obstruct retries | Guard all writes and context; distinguish failures; test mount/event/submit races and retry                   |
| G04 | One browser-wide MACI key is reused across accounts; page-load hydration can create one                                                                                        | Explicit key scope/migration/recovery decision; read-only hydration must not silently replace identity        |
| G05 | Poll screen has mock metadata, eligibility and results; creation is a toast                                                                                                    | P3 real poll descriptor/lifecycle; mark remaining demo-only screens visibly                                   |
| G06 | No proven complete tally-to-Graph-to-UI path; no tally data source                                                                                                             | P4 proof-verified result source and indexing/finality acceptance                                              |
| G07 | Poll deployment defaults use stale absolute dates; selected Poll-0 reportedly has zero dates                                                                                   | Future explicit UNIX windows; read back addresses, policy, schedule and mode before smoke                     |
| G08 | Browser join proving assets are referenced but absent from this checkout's public directory                                                                                    | Provision matching WASM/zkey, verify hashes/depth and browser delivery before smoke                           |
| G09 | Backend returns disclosed nationality/gender and full disclosure output, logs some identity metadata; UI privacy copy overstates confidentiality                               | Minimize disclosures/response/logs; align consent and privacy copy with actual data handling                  |
| G10 | Backend dev CORS permits 5173/3002; default frontend port is 3000                                                                                                              | Align configured origin and public Self callback; verify browser preflight and mobile callback                |
| G11 | Receipt parsing accepts any `0x` prefix; storage exceptions/refresh may lose useful display state                                                                              | Strict shape validation and separate submitted/pending/verified/failed/unknown states                         |
| G12 | No smart-wallet or sponsorship adapter                                                                                                                                         | W1 compatibility spike then implementation; prove actual `msg.sender`, receipt semantics and zero-ETH journey |
| G13 | Native indexed `Vote` is an encrypted message; registrations are not Self-unique people                                                                                        | Schema metrics with explicit definitions; never equate messages, joins and counted voters                     |

These are documentation-review findings, not fixes shipped by this branch. [Roadmap](roadmap.md) assigns their implementation gates.
