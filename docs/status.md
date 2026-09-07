# Current state and evidence

**Reviewed:** 2026-09-05. **Code baseline:** `05d8f2a35` (P1 receipt/hydration follow-ups
on top of `875b399e`; earlier P1 truth work at `60b61b444`, docs snapshot `c6e1fa874`).
This is a snapshot, not live deployment monitoring.

For the **call-by-call map** of what each technology does, read
[journey-map.md](journey-map.md). This file records status and evidence only.

## P2 Enterprise candidate evidence — 2026-09-05

Main base checked: `c12361c3ac2797f98e1238cdca669227fc43ebcc`.
Local branch: `feat/p2-eligibility-bridge`; delivered as a patch, not a remote release.
D02 now selects Enterprise by explicit user instruction. Root and canonical contributor
instructions were corrected. Existing Pass `/verify` and QR remain legacy migration debt.
The new candidate Pass adapter was removed rather than shipped as a competing path.

Implemented: Enterprise session/webhook coordination, actual SDK signature adapter,
account-control verification, bounded in-memory challenge/issuance service, EIP-712
policy and negative tests. **Not mounted, not deployed, not production-ready.**
G01/G09/G10 remain open end to end: the old route is still present, the UI still sends
empty gate data, and live callback/CORS behavior has not been exercised.

The new tests are synthetic backend and local EVM evidence only. Exact final commands,
counts and runtime appear in the P2 handoff below; prior ledger counts are historical.
No real document, hosted session, sponsored operation or full MACI circuit was tested.

## S5 governance extension — 2026-09-06

Patch base: main `c12361c3ac2797f98e1238cdca669227fc43ebcc`; branch
`feat/s5-governance-schema`. New v2 schema and active mappings compile to WASM.
**17 tests pass** across query/schema compatibility, mapping functions with Graph
host doubles and client failure/normalization cases. Graph codegen and build passed
using Graph CLI 0.97.1, graph-ts 0.38.1, published contracts 3.0.0 and Node 24.19.0.
No new dependencies or lock edits. Full workspace/Matchstick/browser tests not run.

A common query validates against v2 and the pinned Messari Governor schema. This is
a locally implemented extension, not an accepted Messari standard. Live Studio and
reference-Governor endpoints are not configured or verified. Main UI/agent consumption
still needs wiring. G06/G13 (verified results) remain open; results are intentionally
unavailable rather than inferred from counts. Detailed evidence and deployment steps:
[subgraph handoff](../apps/subgraph/governance-compatibility.md).

## Branch and deployment status

Snapshot recorded during documentation repair on 2026-09-05. Refresh these rows
from git before starting work; a branch name is not a permanent release identifier.

| Surface                         | Reviewed baseline                                                        | Meaning / next gate                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main code and consolidated docs | `d75b47230c46a78be26942749f9884d2ba8a4167`; P1 code baseline `05d8f2a35` | As-built map covers this code, not unmerged W1 work                                                                                                                                                                              |
| W1 experiment / S2.2            | `w1-privy-experiment` at `e6d693ead4d195eeefa48ba621768a84ccd5e54e`      | Source reviewed separately; 105 frontend and 15 mocked backend tests reproduced. Reconciliation storage handling and new-transaction timestamps remained review findings at this SHA. Check later commits before assigning fixes |
| Live deployment                 | No complete release manifest or end-to-end acceptance recorded here      | Historical addresses/configuration do not establish a live working product; verify poll dates, policy, assets and selected release                                                                                               |
| Graph deployment                | Source mappings exist; live endpoint/query evidence not attached         | Record deployment/version, endpoint, query, indexed block and errors before labeling metrics live                                                                                                                                |

W1 is active, not paused for documentation. Its architecture remains provisional:
a lab scaffold and passing doubles do not prove sponsored signup/join/publish.
When merging W1, translate updates to the consolidated documents; do not restore
removed `current-state.md`, `agent-handoff.md`, `hydration-receipts.md` or `runbook.md`.
Use S2.2 as the canonical task ID, W1 as its legacy alias, and preserve the W1
experiment E1–E6 identifiers with their prefix to avoid confusion with legacy ENS E1.

The existing evidence ledger below contains historical reports. Its earlier test
counts/build results belong to their listed commits and environments, not this
new documentation-only patch. No new live evidence is claimed by this repair.

## Status vocabulary

| Term                | Meaning                                                       |
| ------------------- | ------------------------------------------------------------- |
| **implemented**     | source exists                                                 |
| **locally checked** | the listed command passed on someone's machine                |
| **reported**        | another agent supplied evidence, not independently reproduced |
| **live verified**   | chain or browser evidence exists                              |
| **planned**         | no completed implementation claim                             |

## 1. Source-to-feature map

| Area                         | Source                                                                                                               | Observed state                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Self UI                      | [Auth.tsx](../apps/front-end/src/pages/Auth.tsx)                                                                     | Self QR flow; success stores a browser flag                                               |
| Self backend                 | [verify.ts](../apps/backend/src/routes/verify.ts)                                                                    | Proof verification, age policy, disclosed output; no durable authorization bridge         |
| Vote transaction flow        | [voteFlow.ts](../apps/front-end/src/hooks/voteFlow.ts)                                                               | Atomic signup → lookup/join → publish with captured context and session checks            |
| Wallet/hydration             | [useMaci.ts](../apps/front-end/src/hooks/useMaci.ts), [hydration.ts](../apps/front-end/src/lib/hydration.ts)         | Injected wallet; guarded mount/event hydration; post-submit receipt verify + recheck      |
| Receipt cache                | [receipts.ts](../apps/front-end/src/lib/receipts.ts), [receiptStatus.ts](../apps/front-end/src/lib/receiptStatus.ts) | Context-scoped hash/time plus Poll `PublishMessage` verification                          |
| Poll screen                  | [PollDetail.tsx](../apps/front-end/src/pages/PollDetail.tsx)                                                         | Real voting hook mixed with hardcoded poll/eligibility/result data                        |
| Creation                     | [CreatePoll.tsx](../apps/front-end/src/pages/CreatePoll.tsx)                                                         | UI submission toast, not contract deployment                                              |
| Contracts                    | [contracts package](../packages/contracts/README.md)                                                                 | MACI policy hooks and proof/tally machinery; Self integration not demonstrated            |
| Indexing                     | [subgraph directory](../apps/subgraph)                                                                               | Native event schema/mappings, PollJoined support; no standardized v2 or tally data source |
| ENS / smart wallets / agents | [build.md](build.md)                                                                                                 | Planned; not implemented                                                                  |

## 2. Documentation-review validation

The 2026-09-05 documentation review covered 18 Markdown files. The P1 follow-ups also
change frontend receipt verification, hydration, the poll page and unit tests. Full
workspace build/typecheck is not claimed here unless the recorded command output says so.

## 3. Evidence ledger

| Evidence                                                        | Result and limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current flow, receipt, status and hydration tests               | Independently run: **51 passed, 0 failed.** Command: `node --test apps/front-end/tests/voteFlow.test.mjs apps/front-end/tests/receipts.test.mjs apps/front-end/tests/receiptStatus.test.mjs apps/front-end/tests/hydration.test.mjs` (same files as `pnpm --dir apps/front-end test:unit`). SDK/session/storage doubles; not a browser or cryptographic smoke. Full workspace build/typecheck not rerun (no `node_modules` in this worktree).                                                                                                                                                                                                                                                                                                                                                                                                     |
| `19c3bae08` integration                                         | Implementation agent reported frontend typecheck/Vite build, lint and workspace checks passing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `68f658cf` hydration slice                                      | Merged via `930fb47`; source reviewed here. Build status is not a live acceptance result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Poll-0 dates                                                    | Implementation agent reported `getStartAndEndDate()` = `(0,0)`. No independent RPC recheck in this documentation review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P1 hydration/receipt truth (`60b61b444`)                        | Strict hash/time parsing (G11), distinct wallet-probe outcomes, read-only key helper. Independent review at `c6e1fa874` **reopened G02**: verifier treated a successful MACI recipient as a vote, while Poll `publishMessage` was marked unexpected. Hydration still reset state before `canApply()`, post-submit status stayed `unverified`, reverted UI hid retry controls, and `test:unit` omitted the verifier file.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| P1 poll-receipt follow-up (`2ee992a` and this change)           | Review of `2ee992a` kept G02 **partial**: generic log-topic account matching and constructor `PublishMessage` could false-confirm; delayed hydration could overwrite a newer receipt; save errors skipped in-memory display. This change confirms only a direct EOA `publishMessage(Batch)` to the resolved Poll with the matching event; unknown indirect execution stays unverified; constructor/deployment receipts are unexpected; operation/receipt revision blocks stale writes; persist errors no longer hide display+verify. **G03 still partial.** Unit tests locally rerun on this change; full build/live smoke not claimed here.                                                                                                                                                                                                      |
| P1 review + flight-lock fix (`dcf63d545`)                       | Astra review of `f81f1b8` (51/51 tests) confirmed the receipt/storage fixes but flagged one remaining hydration bug: a delayed hydration finishing after a submission discarded its result yet could never release its in-flight lock (`endFlight` gated on the now-stale operation id), stranding that account until a wallet event or remount. Fix: each hydration run owns the lock (`FlightAnchor`); a new submission invalidates the old run's lock; cleanup releases only the lock that exact run acquired; a run stale before acquiring never grabs it. Regression `delayed hydration -> submission -> stale cleanup -> successful fresh hydration` added. Rerun here: **52 passed, 0 failed**, `npm run build` (tsc + vite) passed. React/browser mount harness and live submit→refresh smoke still outstanding — G02/G03 remain partial. |
| Demographic analytics spec                                      | Accepted product direction (2026-09-05): [demographic-analytics-spec.md](demographic-analytics-spec.md). **No implementation or live verification is established.** DA0 (bounded design, optional synthetic demo) inside event scope; DA1–DA3 post-hackathon. Release protection, consent and attribute semantics are proposed, not deployed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Complete Self → policy → vote → tally → UI                      | **Not demonstrated**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Studio endpoint / cross-protocol query / ENSv2 / sponsored vote | **No verified evidence recorded**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 4. Configured chain context

The [subgraph network config](../apps/subgraph/config/network.json) selects Sepolia
and MACI `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`, with scan start block
`11567000`. Poll-0 was reported as `0x29D39dD442c91dAc51a292fd04a9A7Edd16c22CB`,
deployment block `11567347`. The scan start is not a proven exact deployment block.

Reported zero start/end dates mean Poll-0 cannot be used for a current voting demo.
This does not establish that every poll on the network is closed. Query the chosen
deployment before replacing it. The local generated `deployed-contracts.json` is an
operator artifact, not an independently verified canonical registry. The 2025
archival deployment record contains malformed addresses and must not drive configuration.

## 5. Open gaps (stable IDs)

| ID  | Observed gap                                                                                                                                                                   | Required resolution / acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G01 | Self success only sets a UI flag; no contract authorization or durable uniqueness bridge                                                                                       | P2 policy enforcement and replay/binding tests; direct contract bypass must fail                                                                                                                                                                                                                                                                                                                                                                                                        |
| G02 | Hydration loads stored hash/time without querying receipt or matching poll events                                                                                              | **Partial (P1)**: direct EOA path resolves the poll via `MACI.getPoll` and confirms only `publishMessage(Batch)` calldata to that Poll plus its `PublishMessage` event from the participating `from`. Constructor/placeholder and unrelated MACI txs are unexpected. Unknown indirect execution stays unverified (W1 adapter). Not live-verified.                                                                                                                                       |
| G03 | Hydration starts with unguarded resets; no configured-chain check before lookup; `peekWallet` conflates errors with disconnection; early hydration marker can obstruct retries | **Partial (P1)**: peek-before-write; operation/receipt revision so a delayed lookup cannot overwrite a newer submission; each hydration run owns the in-flight lock (`FlightAnchor`, `dcf63d545`) so a stale run finishing after a vote cannot leave the account stranded; unit race harness includes the delayed overwrite and the delayed-hydration→submission→stale-cleanup→fresh-hydration regression. React/browser mount harness and live submit→refresh smoke still outstanding. |
| G04 | One browser-wide MACI key is reused across accounts; page-load hydration can create one                                                                                        | **Partially resolved (P1)**: read-only hydration now surfaces missing/invalid key instead of creating one; explicit vote still creates a key. Account-scoped key scope/migration decision remains open (W1/UX).                                                                                                                                                                                                                                                                         |
| G05 | Poll screen has mock metadata, eligibility and results; creation is a toast                                                                                                    | P3 real poll descriptor/lifecycle; mark remaining demo-only screens visibly                                                                                                                                                                                                                                                                                                                                                                                                             |
| G06 | No proven complete tally-to-Graph-to-UI path; no tally data source                                                                                                             | P4 proof-verified result source and indexing/finality acceptance                                                                                                                                                                                                                                                                                                                                                                                                                        |
| G07 | Poll deployment defaults use stale absolute dates; selected Poll-0 reportedly has zero dates                                                                                   | Future explicit UNIX windows; read back addresses, policy, schedule and mode before smoke                                                                                                                                                                                                                                                                                                                                                                                               |
| G08 | Browser join proving assets are referenced but absent from this checkout's public directory                                                                                    | Provision matching WASM/zkey, verify hashes/depth and browser delivery before smoke                                                                                                                                                                                                                                                                                                                                                                                                     |
| G09 | Backend returns disclosed nationality/gender and full disclosure output, logs some identity metadata; UI privacy copy overstates confidentiality                               | Minimize disclosures/response/logs; align consent and privacy copy with actual data handling                                                                                                                                                                                                                                                                                                                                                                                            |
| G10 | Backend dev CORS permits 5173/3002; default frontend port is 3000                                                                                                              | Align configured origin and public Self callback; verify browser preflight and mobile callback                                                                                                                                                                                                                                                                                                                                                                                          |
| G11 | Receipt parsing accepts any `0x` prefix; storage exceptions/refresh may lose useful display state                                                                              | **Resolved (P1)**: strict `0x` + 64-hex validation and finite positive timestamps; parse failure reasons labeled; load stays "unable to confirm".                                                                                                                                                                                                                                                                                                                                       |
| G12 | No smart-wallet or sponsorship adapter                                                                                                                                         | W1 compatibility spike then implementation; prove actual `msg.sender`, receipt semantics and zero-ETH journey                                                                                                                                                                                                                                                                                                                                                                           |
| G13 | Native indexed `Vote` is an encrypted message; registrations are not Self-unique people                                                                                        | Schema metrics with explicit definitions; never equate messages, joins and counted voters                                                                                                                                                                                                                                                                                                                                                                                               |

G01 and G05–G13 remain documentation-review findings. G02/G03/G04/G11 reflect the P1
code follow-ups. [roadmap.md](roadmap.md) assigns remaining implementation gates.

---

## 6. Refresh hydration and receipt recovery

Slice implemented in `68f658cf`, reviewed at `7fce1e1` on 2026-09-05. This replaces
an earlier description that overstated validation and race protection. Open findings
are G02–G04/G11 above.

### Implemented behavior

[useMaci.ts](../apps/front-end/src/hooks/useMaci.ts) attempts mount/account/chain-event
hydration from already-connected wallet state and SDK signup/join lookups. It includes
generation/busy guards, though not all writes are guarded. The vote flow captures
submission context and the page suppresses confirmations belonging to another account.

[receipts.ts](../apps/front-end/src/lib/receipts.ts) stores transaction hash and
submission time under chain + MACI + poll + wallet. It does not store the selected
option. Context scoping prevents ordinary cross-context cache lookup, but is not proof
of transaction provenance. Local storage is user-editable and can be unavailable.

P1 follow-up (2026-09-05) tightened the truth contract, then a review at `c6e1fa874`
showed the first verifier checked the **MACI recipient** rather than a Poll
publication. The current contract:

- **Strict shape (G11).** `parseStoredReceipt` accepts only a real `0x`-prefixed 64-hex transaction hash and a finite positive timestamp, and labels the failure reason (invalid-json / invalid-tx-hash / invalid-time). Any malformed record loads as `null` = "unable to confirm".
- **Chain verification (G02, still partial).** [receiptStatus.ts](../apps/front-end/src/lib/receiptStatus.ts) resolves the poll through `MACI.getPoll`. **Confirmed** requires the participating account to call `publishMessage` or `publishMessageBatch` on that Poll (calldata + `to`) and that Poll to emit `PublishMessage`. The constructor's placeholder `PublishMessage` is not a vote. A successful MACI signup is `unexpected`. Unknown indirect execution (EntryPoint / smart account) stays `unverified` until a W1 adapter exists. Generic log-topic address matching is not used.
- **Marker retry + distinct states (G03, still partial).** [hydration.ts](../apps/front-end/src/lib/hydration.ts) peeks before any write. Duplicate/in-flight/busy/stale runs cannot blank the display and then skip restore. An operation/receipt revision invalidates in-flight hydration when a submission starts, so a delayed RPC cannot overwrite a newer receipt. Each hydration run owns the in-flight lock (`FlightAnchor`): a new submission invalidates an older run's lock, and cleanup releases only the lock that exact run acquired — so a delayed hydration finishing after a vote no longer leaves the account permanently "in flight" (regression added with `dcf63d545`). The marker is set only after participation lookup **and** the receipt check attempt. A unit race harness covers overlapping peek/lookup/receipt/submit/event cases including delayed overwrite and stale cleanup after a submission. There is still no React/browser mount harness.
- **Post-submit status.** After `publish` the hook verifies immediately and exposes a guarded `recheckReceipt` for pending/unavailable/unverified/unexpected. Persistence errors do not skip in-memory display and verification. Users should not need a reload to leave `unverified`.
- **Read-only key (G04 guard).** Hydration now reads existing key material and surfaces missing/invalid/storage-error states instead of silently creating a new voting identity on page load. An explicit vote still creates a key when needed.

The poll page shows participation notices even when no account is in React state (so
wrong-chain is not hidden behind "Connect Wallet"), keeps vote buttons visible next to
a reverted receipt, and offers "Check again" for recoverable statuses.

### Required recovery contract

1. Inspect account/chain without prompting. Distinguish no provider, disconnected, wrong chain and failed lookup.
2. Snapshot context and generation. Guard initial resets and every later state write. A refresh lookup must not overwrite a newer submission or wallet context.
3. Read existing key material; expose missing/corrupt/recovery state. Do not silently create a new identity during read-only hydration.
4. Look up signup and poll membership. A failure is unknown/retryable, not "not registered". Clear or invalidate hydration markers appropriately after failure.
5. Parse stored receipts strictly, then query the configured chain. Verify successful inclusion and expected poll publish evidence. For smart accounts, support the actual execution/event context rather than assuming outer transaction `from` equals the participant.
6. Distinguish cached/unverified, pending, failed, confirmed and temporarily unavailable. A not-found receipt may be pending or unavailable; do not infer failure from one lookup.
7. Keep "submission confirmed" separate from "counted". Indexer lag and tally finality have separate states.
8. Storage failure must not erase the useful in-memory result of an already-confirmed submission. Keep receipt ownership anchored to the original captured context.

Transaction matching must be specified against the deployed ABI and execution model;
hash format alone cannot establish that the expected encrypted publish occurred.
Define confirmation depth/reorg handling in the deployment profile and recheck stale
cache entries.

### Acceptance

Run submit → refresh → reconnect, then repeat with wallet/network switches during
hydration and submission. Cover failed RPC lookup/retry, pending/reverted/unrelated
transaction hashes, malformed/unavailable storage, missing voting key and
smart-account execution. Assertions must observe actual hook/UI behavior for race cases.

Current 14 flow, 8 receipt-storage, Poll-publication, and hydration-race unit tests are
listed in [build.md](build.md). They do not prove React hydration race safety or live
receipt validation. There is no complete voter dashboard claim.

---

## 7. Historical: reliable vote submission (first P1 implementation)

> **Historical implementation report.** Integrated in `19c3bae08`; later
> hydration/receipt work landed in `68f658cf`. Its original build/access limits
> describe an earlier environment, not current status. Base reviewed: `32cc13d26`.

### Changes

- Signup, membership recovery/join and publish run as one asynchronous operation. The returned poll state index is passed directly into publish, rather than read from a stale React render.
- The browser SDK entrypoint supplies the WASM join implementation. Vite prebundling matches that entrypoint.
- Empty gate data is `0x`, not the invalid odd-length byte string `0x0`.
- Signup and poll membership are checked on chain each attempt, so a reload or rejected publish does not blindly repeat join transactions.
- Synchronous locks prevent overlapping click handlers and wallet operations. Busy controls cover connection and signup as well as joining and publishing.
- Network is checked before connecting and at flow boundaries. Account/network changes abort subsequent steps and invalidate hook display state. An already-submitted transaction cannot be cancelled by this guard.
- Invalid saved voting keys fail explicitly instead of silently replacing the user's key.
- Confirmation describes message submission and shows its transaction hash. The nonfunctional update-vote control is removed pending properly specified update/nonce semantics.

### Validation

```sh
node --test apps/front-end/tests/voteFlow.test.mjs
```

Eleven tests passed in the implementation environment. Tests execute the actual
TypeScript flow with mocked SDK/session dependencies. On Node 20 they use the
project's installed TypeScript package to transpile the module. They do not verify
cryptography, the React DOM, bundling or a live deployment.

Creating the remote branch was rejected by the GitHub integration with HTTP 403
(Resource not accessible by integration). No remote branch or PR was created; the
change was delivered as a local commit and Git patch.

The full frontend build was blocked: workspace dependencies were unavailable
(`tsc: not found`). No successful typecheck, Vite build or live-wallet browser smoke
test was claimed at that time.

### Required integration check before merge

1. Use the repo-supported Node/pnpm versions and install/build workspace dependencies.
2. Set `VITE_MACI_ADDRESS`, `VITE_CHAIN_ID`, `VITE_POLL_ID` and `VITE_MACI_START_BLOCK` to the confirmed deployment. Set the start block explicitly to avoid an expensive genesis scan. The current subgraph configuration records block 11567000; verify that this covers the required signup/join events for the selected deployment.
3. Run the frontend typecheck/build and the regression command above. Confirm the PollJoining WASM and zkey URLs actually serve the expected artifacts; they were not present in the cloned frontend tree.
4. With a test wallet on the configured testnet, submit a first vote through one click. Reject a signup/join/publish prompt and retry. Reload after joining and confirm no second join transaction is requested. Attempt a wrong-network connection and switch accounts mid-flow.
5. Check the displayed transaction against the selected poll. A successful submission is not proof that a ballot was counted; complete processing/tally validation separately.

### Deliberately remaining P1/M1 work

- Existing browser-wide MACI key storage is preserved to avoid abandoning registered keys. Account/deployment-scoped key migration, backup and recovery still need design and implementation. Account-change guards do not establish separate voter identities for separate wallets.
- Vote receipts were not persisted across page reloads at that snapshot. Nonce remains 1 for the baseline single-submission demo; supported updates, key changes and cross-device voting are not implemented. Do not treat refresh as an update-vote workflow.
- Self eligibility authorization is still placeholder gate data and requires P2. The page still has mocked eligibility and result data pending P3.
- Final tally/index/UI integration requires P4. A refreshed page recovers membership on the next submission attempt; this patch did not hydrate a complete voter dashboard on page load.
- Poll metadata, timing and option validation against the deployed poll, gas sponsorship, ENS and agent features remain separate work.

## P2 verification result

Node 22.18.0: 30 backend tests and 9 local EVM tests passed. W1+P2 temporary
backend overlay: 45 tests passed. Focused TypeScript and compiled ESM import passed.
Enterprise lock generation remains blocked (network approval cancelled); the manifest
requires lock regeneration before a frozen install or merge. Root Node 20 versus SDK
dependencies' Node 22 requirement is an unresolved deployment boundary. See the exact
[handoff](agents.md#p2-enterprise-handoff--2026-09-06). No live or full workspace result.

## Runtime decision: Node 22 (resolved 2026-09-06)

**Decision: `>=22 <23`**, recorded in root `engines.node` (was `20`). Rationale, from
verified facts:

- The SDK's transitive dependency `@selfxyz/core@1.2.0-beta.1` declares
  `>=22 <23`; the top-level `@selfxyz/enterprise-sdk@0.4.1` declares `>=20`. The
  narrowest satisfying range is Node 22.
- `@selfxyz/core` ships zero `node:` built-in imports in its dist (universal
  browser/react-native/node bundle), so the `>=22 <23` pin is provenance metadata,
  not an API requirement — but honoring declared engines is cheaper than auditing
  every future release of that package.
- Node 20 reached end-of-life April 2026; Node 22 is Maintenance LTS until
  April 2027. Upstream MACI pins node 20; this is a deliberate, documented
  deviation from our fork base.
- Node 24/26 were rejected: they violate the SDK's `<23` upper bound.

Empirical verification on Node **22.20.0** (post-merge, this repository):
30/30 backend P2 tests, 9/9 local EVM tests, 45/45 combined W1+P2 overlay,
`tsc -p tsconfig.p2.json --noEmit` clean — all green on Node 22. Earlier runs on
Node 20.19.5 were also green, confirming no Node-22-only API is actually required
today; the pin is forward-compatibility insurance, not a current dependency.

W1 must be re-validated on Node 22 before its next merge (W1 was last run on
Node 20 under the old pin); the toolchain used for P2 verification is preserved at
`~/Hermes-crypto-builder/p2-toolchain/` (node 20.19.5, node 22.20.0, pnpm 10.34.5).
