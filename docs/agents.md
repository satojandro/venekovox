# Agent handoff and continuity protocol

## S2.1 / WP2 independent review — 2026-09-10

- Owner: Astra. Checkout `exp/provider-trial-self-vs-zkpassport`, base `d5b978ac`;
  fetched/reviewed main `f094d1b9` via `/private/tmp/venekovox-wp2-review` snapshot.
- Request: second opinion on Hermes's repeated ZKPassport scan failure.
- Added `docs/reviews/wp2-2026-09-10/review.md` and offline real-SDK parity harness;
  updated this record/status. Existing dirty docs/design preserved.
- Verified: Node 22.20.0, harness 3/3; main p2 64/64 after localhost sandbox
  permission. Three public OPRF key endpoints responded with matching keys.
- Finding: public mobile source exposes a broad error wrapper including salted
  OPRF and input generation; same-input trial/product requests agree. Age range
  removal rationale is incorrect. Live-mode mock config and slow-session recovery
  need separate fixes; neither establishes the scan's cause.
- No native scan, main runtime edit, credentials, commit/push or deployment.
  Source-to-installed-app parity remains unverified. Report includes exact citations.
- Next: owner-operated fresh trial/product comparison; sanitized inner exception
  and OPRF timing; alternate network when available. User is travelling with Wi-Fi
  only, app 1.3.1, so do not assume a cellular test happened.
- Dirty delivery: this/status documentation, new review directory; prior design
  directory still uncommitted. No task messages were sent to Hermes.

## S3.2 presentation concept — 2026-09-09

- Follow-up: user requested inclusive cypherpunk tone, light/dark themes,
  signed-in/out states and cross-border narrative. Added three boards plus
  prompts/design review under `docs/design/poll-mockups-2026-09-09/v2/`.
  Read existing Landing.tsx narrative. Visually inspected; no runtime tests or
  live claims. State/icon/chart corrections documented before implementation.

- Owner: Codex; branch `exp/provider-trial-self-vs-zkpassport`, base `d5b978ac`.
- User request: beautiful mockups for the supplied four-poll slate and journey.
- Added `docs/design/poll-mockups-2026-09-09/` (two PNG boards and exact prompts)
  and this/status documentation. Existing checkout was clean; runtime untouched.
- Validation: visually inspected generated desktop/mobile images. Synthetic
  results explicitly labeled; no live-chain claim or product gate closed.
- Delivery: uncommitted design files and documentation; no push or deployment.
- Next: user design review before translating the concept into product screens;
  existing identity/deployment/results gates remain as recorded below.

## C product mount — 2026-09-09

- Owner: Cursor; reviewer/committer: Hermes. Branch `exp/provider-trial-self-vs-zkpassport`.
- Goal: mount ZKPassport into `app.ts` + replace Auth + plumb join `sgDataArg`.
- Changed: backend eligibility router/product factory/session store; Auth ZKPassport
  flow; voteFlow/useMaci `sgDataArg` + policy.enforce dry-run; tests; status/roadmap/journey.
- SDK join param: `joinPoll({ sgDataArg })` → `Poll.joinPoll(..., _signUpPolicyData)`.
  Signup still `sgData: "0x"`.
- Gaps: in-memory sessions (G01), WP0 real policy, no live product-UI passport this turn.
  FE sessionStorage is tab-scoped only; dry-run unit-tested, not live against a
  deployed policy. Extra `venekovox-c-mount` worktree/branches were removed; work
  lives only in this checkout.
- Local proof this turn: backend typecheck:p2 + build; p2 64/64; EVM 9/9;
  FE unit 91/91 + build; live curl of `/eligibility/*` + `/verify`; browser
  `/trust-ritual` unverified + no-wallet error. Uncommitted until Hermes reviews.
  Do not merge to main before the C gate.

## Start every work session

**Latest accepted priority, 2026-09-07:** execute Stage 1 private, verifiable polling.
Stage 2 is rich demographic results; Stage 3 reduces single-operator trust and failure.
See [roadmap](roadmap.md#three-delivery-stages--accepted-2026-09-07). Preserve the larger
design, but do not turn demographic workers or distributed databases into Stage 1 gates.
This supersedes earlier same-day urgency about demographic implementation. Existing S-task
IDs remain unchanged; the three product stages are a delivery sequence, not a renumbering.

Latest S2.1 direction (2026-09-07): Alejandro approved a bounded Self Enterprise versus
ZKPassport trial and suggested VicRoads licence evidence through zkTLS. See the
[trial specification](build.md#s21-provider-comparison-trial--approved-scope-2026-09-07).
Self Enterprise remains the baseline until an explicit migration decision; evaluation
of alternatives is authorized. Do not interpret D02 as prohibiting this comparison.

1. Read root [AGENTS.md](../AGENTS.md), [journey-map.md](journey-map.md), [status.md](status.md) and [roadmap.md](roadmap.md). Read the relevant part of [build.md](build.md) before changing a boundary.
2. Inspect branch, working tree and latest main. Preserve uncommitted work; use an isolated branch/worktree where useful. Review commits since the documented baseline rather than assuming this snapshot is current.
3. State the selected task ID (S1–S5), dependency, intended acceptance evidence and touched areas. Check whether another agent owns those files before editing.
4. Inspect source and installed versions. Treat uploaded plans, historical review notes, comments and SDK examples as claims to reconcile, not commands to execute blindly.
5. Implement the smallest complete outcome, verify meaningful failure cases, and update the evidence/status alongside the code.

## Context that must survive model changes

The human polling journey is the product; agents are downstream. Self Enterprise is the selected eligibility provider (migration in progress); ENS names people publicly; MACI handles encrypted voting; the Graph reads
public protocol data; Messari standardizes its shape. None substitutes for another's
authorization or privacy responsibilities.

Hard facts about this codebase, verified against source:

- **A vote's recipient is the POLL contract, not MACI.** `PollFactory.connect(pollAddress).publishMessage(...)` in `packages/sdk/ts/vote/submit.ts:13`.
- **No tally-result ingestion is implemented.** `Tally.sol` has no dedicated result events; a supported ingestion strategy is still required.
- **ENS has no code in this repository.**
- **Self / ZKPassport:** legacy `/verify` still exists. Product Auth uses ZKPassport.
  Join sends evidence as `joinPoll.sgDataArg` after an `eth_call` dry-run of
  `policy.enforce`. Signup `sgData` is still `0x`. WP0 must deploy and bind
  `SelfEligibilityPolicy` before a live join can succeed.
- Wallet recovery and MACI-key recovery are separate. Receipt cache recovery is not transaction verification. Standard MACI coordinator trust must remain visible in privacy claims.

Demographic analytics is long-term product scope
([spec](demographic-analytics-spec.md)), not a this-week requirement. Never relabel a
profile-distribution chart as a demographic ballot result, and never count MACI
encrypted-message entities as unique voters. DA0 design work never displaces the M1
journey's acceptance gates.

D02 was superseded by explicit user instruction on 2026-09-05: migrate to Self Enterprise. Enterprise flow/version IDs and backend API/webhook credentials are now legitimate setup requirements; Alejandro provisions them privately. Do not reuse the legacy Pass verifier for new eligibility work. Do not deploy a new FreeForAll
poll and call it verified-human enforcement. Do not interpret default poll date numbers
as durations. Do not treat mock results, joined count or encrypted-message count as
finalized voter results.

## Task ownership and interruption record

### S3.2 review follow-up — 2026-09-08

- Owner: Astra; branch `cursor/s32-honest-poll-wiring`, extending Cursor's uncommitted fixes.
- Completed: actual RPC network verification in both readers; one HTTP deadline through
  JSON body loading with abort; backend provider cleanup; regression tests.
- Validation: frontend `test:unit` **84 passed**, backend `test:polls` **2 passed**;
  frontend/backend `build` passed; `git diff --check` passed. Existing frontend build
  warnings remain; no live vote or browser lifecycle smoke.
- Files: backend poll route/test/script; frontend schedule, health, timeout helper and
  regression tests; status and continuity docs.
- Remaining: browser interval/click smoke and Stage 1 deployment/identity/results gates.
  Changes are uncommitted; preserve the pre-existing Cursor edits when continuing.

### S3.2 poll identity, refresh and timeouts — 2026-09-08

- Owner: Cursor; branch `cursor/s32-honest-poll-wiring` (review fixes on the honest-wiring work).
- Goal: reject a backend schedule that names a different chain/MACI/poll; refresh the
  voting window on an interval and again before submit; bound hung `/health` and
  `/polls/configured` so RPC fallback can start.
- Changed: frontend schedule identity + `withTimeout`, parallel health/schedule loads,
  15s refresh + vote-time recheck, backend `chainId` on `/polls/configured`, unit tests,
  status/roadmap/agents.
- Not changed: Self Pass QR, Enterprise mount, Privy, subgraph results, poll deployment.
- Validation: `pnpm --dir apps/front-end test:unit` **81 passed**. Frontend and backend
  `build` passed. Live `GET /polls/configured` includes `chainId` and Poll-0 identity;
  window still `3600`/`3600` → `INVALID_WINDOW`. No live vote; browser interval/click
  recheck not exercised this turn.
- Next: deploy a votable poll with explicit dates; then mount Enterprise and a result reader.

### S3.2 / G10 honest poll wiring — 2026-09-07

- Owner: Cursor; branch `cursor/s32-honest-poll-wiring` from main `53975080683aa919b2595a87f80118622f9157de`.
- Goal: replace fake poll list/results with one configured descriptor plus on-chain window; let the Vite origin reach `/health`.
- Changed: front-end poll descriptor/schedule/health reader, Polls/PollDetail, backend CORS 3000/3001, unit tests, status/journey/roadmap.
- Not changed: Self Pass QR, Enterprise mount, Privy, subgraph results, poll deployment.
- Validation: `pnpm --dir apps/front-end test:unit` **71 passed**. Browser `/polls` and
  `/polls/0` showed backend `/health` plus `GET /polls/configured` (`3600`/`3600` →
  INVALID_WINDOW, vote buttons disabled, no fake totals).
- Next: deploy a votable poll with explicit dates; then mount Enterprise and a result reader.

### Three-stage prioritization handoff — 2026-09-07

- Owner: Astra; base/branch main `81950b4215a313649ab7f5d6b0b6dedc6269a96f`.
- User-approved outcome: three explicit delivery stages; private, verifiable polling active.
- Changed this turn: roadmap, journey, build, demographic spec, data/tally architecture,
  status and agents. Preserved all earlier dirty docs, including README.
- Validation: `git diff --check` and local Markdown link targets in touched docs.
- No runtime code, tests, deployments or live claims. Documentation remains uncommitted.
- Next: Stage 1 actual-account eligibility enforcement, real poll/proving configuration,
  submission/recovery and verified overall result delivery; use Hermes's provider evidence.
- External setup: Alejandro controls provider configuration, document verification and
  funded signing. No new technology selection or secrets requested by this update.

### S2.1 / S3 / S4 / DA architecture handoff — 2026-09-07

- Owner: Astra; base/branch main `81950b4215a313649ab7f5d6b0b6dedc6269a96f`.
- User steering: do concrete architecture work; do not infer a basic-demo-only scope
  or exclude demographics from the deadline discussion. Hermes owns the provider trial
  through the user's handoff; no message sent to Hermes by this task.
- Deliverable: data-and-tally-architecture.md, with source-grounded storage/access roles,
  exact processing path, result ingestion alternative, binding mechanism and A/B/C tradeoffs.
- Findings: existing verified Tally result storage, FULL circuit mode, stable ballot-index
  join and age-only Enterprise adapter. All source-reviewed, not newly runtime-tested.
- Validation: `git diff --check`, relative Markdown target check. Default shell reports
  Node 26.7.0/pnpm 11.19.0, outside repo toolchain; no runtime test attempted with it.
- Dirty work: prior five docs plus new architecture document and docs/README.md. No
  code/deployment/migration, commit, push or live-chain claim.
- Next: implement canonical result snapshot reader; exercise FULL/one-credit parity;
  build synthetic authenticated-binding/aggregation harness. Actual operator visibility
  and release policy require a concrete decision before real demographic collection.
- External setup: Alejandro controls document/account sessions and signer/issuer secrets.

### S2.1 / DA0 political pilot handoff — 2026-09-07

- Owner: Astra; main base `81950b4215a313649ab7f5d6b0b6dedc6269a96f`.
- Goal: translate Alejandro's political-polling priority into bounded evidence and
  demographic release requirements; proposal in demographic-analytics-spec.md.
- Touched: demographic-analytics-spec.md, roadmap.md, status.md and this file; preserved
  prior uncommitted build.md/provider-trial edits. Five documentation files now dirty.
- Validation: public State Department/AEC/AAPOR/EDPB source review and `git diff --check`;
  no runtime tests, proof generation, account access or deployment.
- Decision correction: Alejandro accepts passport nationality as citizenship proxy with
  no additional non-citizen-national check; official document sex/gender only, no
  self-described override. Official-source demographic policy is in the pilot spec.
- Next: execute isolated provider comparison for nationality, document sex/gender and age ranges;
  investigate authenticated counted-ballot/attribute binding before live collection.
- Unresolved: actual provider support, uniqueness, operator visibility, release thresholds,
  pricing, real sources and recovery. Alejandro controls documents and private accounts.
- Delivery: uncommitted documentation only; no push/PR or implemented analytics claim.

### S2.1 trial definition handoff — 2026-09-07

- Owner: Astra. Base/working branch: `81950b4215a313649ab7f5d6b0b6dedc6269a96f`, main.
- Goal: record the approved bounded provider comparison and VicRoads feasibility gates.
- Changed: `docs/build.md`, `docs/roadmap.md`, `docs/status.md`, `docs/agents.md`.
- Checks: `git status --short --branch` initially clean; `git worktree list` showed
  only main; `git diff --check` passed. No application code changed or runtime tests run.
- Evidence: primary-source links in build.md; no live document, account or chain proof.
- Unverified: provider costs, actual VicRoads response/TLS compatibility, document
  coverage, recovery and cross-provider uniqueness. Trial execution remains outstanding.
- Dirty work: the four documentation files above are uncommitted; no push or PR.
- Next: pin provider versions and build isolated synthetic verification/authorization
  harnesses following build.md, then run owner-operated document comparisons.
- External setup: Alejandro controls Self configuration, personal documents and any
  private VicRoads login/MFA. Credentials and identity payloads stay out of agent context.

No implementation owner is assigned indefinitely by this document. At pickup, record a
fresh owner and branch; do not assume a prior model is still running.

Use this small record in a PR description or a dated handoff entry:

```text
Task ID / owner / date:
Base commit and working branch:
Goal and acceptance gate:
Changed paths and decisions:
Commands run and exact results:
Live evidence (public links only):
Known failures / unverified claims:
Dirty or uncommitted work:
Next concrete action:
External setup required and who controls it:
```

Before interruption, commit reviewable work or explicitly list the dirty files. Record
an in-progress test/deploy's status; an issued command is not success. Never claim a
remote push/PR if only a local commit or patch exists.

## Completion rules

- Update [status.md](status.md) with the new commit/evidence and close only gaps actually resolved.
- Update [roadmap.md](roadmap.md) when decisions, dependencies or gates change.
- **Update [journey-map.md](journey-map.md) in the same commit as code that changes a call path** — marker, call chain with a real file:line citation, and baseline SHA.
- Link an exact public deployment/query/transaction when making a live claim. Do not commit secrets, identity documents, raw Self payloads or private voting/coordinator keys.
- Keep implementation changes separate from historical documentation evidence. Mark reported versus reproduced checks.
- For hackathon attribution, record pre-existing upstream and project work separately from work done within the eligible event period. A continuity submission is not a claim that all commits are new.
- If access blocks pushing, deliver an applyable patch and say the remote branch was not created. Do not bypass integration access controls.

## Documentation conflict resolution

Newest explicit product instruction controls intent. Observed code/chain behavior
controls implementation truth. The decision register explains design choices; the
roadmap sets gates. Historical notes remain useful history, but their "next steps" are
not a second active backlog. Resolve contradictions by updating these canonical
documents in the same change.

## Documentation repair handoff (2026-09-05)

- Base: main `d75b47230c46a78be26942749f9884d2ba8a4167`.
- Scope: documentation only; privacy/evidence corrections, proposed journey and
  ENS interaction contract, consolidated links and branch/deployment context.
- Code boundary: as-built map remains the main/P1 snapshot; W1 source is separate.
- Validation: relative document links and patch applicability checked; no application
  build, live wallet operation, deployment or new prize eligibility verification.
- Next: apply the patch on its base (or review changes against newer main), then
  reconcile W1 into the consolidated docs when its code is merged. Do not infer
  architecture approval from the presence of a proposed diagram.

## P2 Enterprise handoff — 2026-09-06

- Owner: Astra; task S2.1/P2. Local branch `feat/p2-eligibility-bridge`.
- Patch base: main `c12361c3ac2797f98e1238cdca669227fc43ebcc`.
- W1 comparison: `e4e0c65a4f66248bd9f5775139a064754bd01fc7` on
  `w1-privy-experiment`; still separate from main at review time.
- Product decision: user approved Enterprise on September 5; D02 supersedes Pass-only
  instructions. Provider pivot accepted; issuer custody/deployment and eligibility
  policy defaults remain candidate decisions.
- Implemented: isolated session coordinator, native SDK adapter, EOA/ERC-1271 ownership,
  scoped authorization service, issuer policy, tests and canonical migration guidance.
- Reproduced on Node 22.18.0 with isolated dependencies: **30 backend tests**, **9 local
  EVM tests**; **45 backend tests** on a temporary W1+P2 source overlay (15 W1 + 30 P2).
  Focused `tsc -p apps/backend/tsconfig.p2.json --noEmit` passed. Compiled native ESM
  adapter imported successfully on Node 22. Full workspace/frontend build not run.
- Commands: `node --test apps/backend/tests/p2/*.test.mjs`;
  `node --test packages/contracts/test-p2/eligibility.evm.test.mjs`;
  combined overlay additionally ran W1 `labSendPolicy.test.mjs` and
  `sponsoredSendRoute.test.mjs`. Test-only loader used `P2_TOOLCHAIN_PACKAGE_JSON` for
  dependencies outside the repository. All signing material was synthetic local fixtures.
- Dependency gate: SDK 0.4.1 is declared in backend package.json. Workspace pnpm lock
  regeneration could not complete because the network approval was cancelled. The
  supplied lock only includes the already-resolved ethers importer addition, NOT the
  Enterprise SDK dependency graph. **This candidate patch is not frozen-lock/merge ready.**
  Hermes must regenerate the lock using repository-approved pnpm 9/10, review dependency
  changes, and run frozen install/build before merging. Do not fabricate integrity entries.
- Runtime gate: root declares Node 20; resolved Enterprise core/common declare Node 22.
  Do not silently change W1's runtime. Decide a tested Node 22 backend boundary or perform
  a separately validated runtime upgrade; this patch contains a native ESM adapter and
  targeted tsconfig but does not make that deployment decision.
- Compatibility: no W1 frontend/runtime route edits. Backend package.json overlaps W1:
  merge scripts/dependencies structurally, retaining `test:unit`, `test:p2` and
  `typecheck:p2`. The legacy verify.ts change is a warning comment only.
- Live evidence: none. Public routes, durable transactional session/inbox persistence,
  UI/status recovery and SDK gate-data plumbing are unimplemented. G01/G09/G10 stay open.
- Next action: regenerate/review the dependency lock and resolve the Node runtime boundary;
  then mount the candidate with durable storage, integrate W1 evidence slots and execute
  Enterprise test/live document verification plus a real votable poll.
- External setup: Alejandro creates the approved Enterprise flow/version, test API key,
  webhook endpoint and signing secret privately; funds/controls deployed accounts.
- Working tree: changes delivered as patch/ZIP; no remote commit, push, PR or deployment.

## S5 handoff — 2026-09-06

- Owner/task: Astra, S5.1/T4 plus bounded S5.2 comparative reader.
- Base/branch: main `c12361c3ac2797f98e1238cdca669227fc43ebcc`, `feat/s5-governance-schema`.
- Scope: subgraph schema/mappings/tests/client and narrow canonical doc updates.
- Verified: Graph codegen, WASM build, 17 Node tests; no Matchstick/live/browser evidence.
- Live/remaining: deploy v2 to Studio, choose a compatible live Governor endpoint, run
  comparison, wire main-product/agent consumer, capture demo. Tally ingestion stays open.
- Merge: no W1/P2 runtime overlap or dependency changes. Preserve P2's Enterprise D02
  and related documentation when merging these narrow hunks. This baseline predates
  that patch: **the old Pass-only instructions above are superseded by Alejandro's
  Enterprise decision**, not reinstated by S5. Do not overwrite newer docs wholesale.
- Detailed contribution and commands: [subgraph handoff](../apps/subgraph/governance-compatibility.md).
- Delivery: local patch/ZIP; no upstream PR, remote push or deployment claimed.

## S1.1 ENS handoff — 2026-09-06

- Owner: Hermes; base `c580b245b8321e04e37164b5d8b21d3298f06f4a`; branch `feat/ens-poll-discovery`.
- Scope: new resolver/read-only NamedPoll page, two routes, explorer link, public RPC
  env example, tests and canonical doc additions. No dependency or lock change.
- Preserve W1/P2/S5 changes when merging; App.tsx and package.json may overlap future
  UI changes. Merge scripts/routes structurally. Do not overwrite newer docs wholesale.
- Native ENSv2 registration and authorized record writing are operator setup; no write,
  key handling, deployment, upstream PR or live success was performed here.
- Next concrete action: apply/check, configure RPC and a real name/record, browser smoke
  `/discover` → checked card → share/reopen; integrate real voting only after its route
  consumes the same validated target.

ENS verification addendum: focused strict TypeScript checking passed on Node 22.18.0,
and the NamedPoll component bundled successfully for browsers. Full application build,
React/browser race tests and live RPC/CCIP/name registration were not run. No dependency
or lockfile changes are needed. Tests use ethers 6.15.0 and synthetic RPC responses.
