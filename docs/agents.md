# Agent handoff and continuity protocol

## Start every work session

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
- **ENS discovery is implemented; an undeployed registration candidate is documented in
  [ens-registration.md](ens-registration.md).** Neither is live verification evidence.
- **Self verification stops at a browser flag.** `sgData` is `0x`; the recorded configuration uses `FreeForAll`. Verify selected deployment state before live claims.
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

## S1.1 registration interruption record — 2026-09-07

- Task/owner/date: S1.1 second patch / Astra / 2026-09-07.
- Base/branch: `81950b4215a313649ab7f5d6b0b6dedc6269a96f`, `codex/ens-registration-v2`.
  Started from a clean checkout; W1 remains separate. No subagents used.
- Goal/gate: optional account claims and reconnect recovery, operator naming of existing
  polls, compatible with the merged discovery reader. Local candidate implemented;
  actual ENSv2 registration, W1 onboarding/sponsorship and real named voting still open.
- Changes/decisions: narrow custom registrar/resolver, dedicated profile/poll registries,
  no owner transfer/resolver roles, explicit deployment expiry and retained parent powers.
  These are candidate deployment semantics, not D04 permanence signoff. See
  [detailed operator handoff](ens-registration.md).
- Evidence: Node 22.20.0 / pnpm 10.34.5; 73 frontend unit, 3 React/jsdom, 8 EVM-double
  and 2 preparation tests passed. Strict focused TypeScript, frontend ESLint, formatting,
  SDK dependency build and frontend production build passed. Solidity lint has zero
  errors but NatSpec/gas/configuration warnings. Commands and dependency limitations are
  in the detailed handoff; no running install/deployment is left pending at delivery.
- Failures/limitations: initial install was blocked by sandbox DNS; approved frozen
  install then succeeded with scripts disabled. Initial build lacked workspace SDK
  outputs; an approved explicit dependency build resolved that. Existing MACI browser
  export warnings remain. EVM tests use a registry double, not upstream ENSv2 bytecode.
  No live links, native-wallet browser signing or eligibility/vote evidence.
- Delivery: files written directly in the repository, **uncommitted**. No push/PR or
  deployment. Dirty paths: frontend `.env.example`, `package.json`, `src/App.tsx`,
  `src/pages/NamedPoll.tsx`, new `src/pages/Names.tsx`, new `src/ens/registration.ts`,
  new `src/ens/injectedNamingWallet.ts`, `tests/ens/pollName.test.mjs`, new
  `tests/ens/load.mjs`, `tests/ens/registration.test.mjs`, `tests/ens/Names.ui.test.tsx`;
  contracts `package.json`, new `contracts/ens/VenekoVoxNames.sol`,
  `scripts/prepareEnsRegistration.mjs`, `test-ens/names.evm.test.mjs`,
  `test-ens/prepare.test.mjs`; docs `agents.md`, `build.md`, `journey-map.md`,
  `roadmap.md`, `status.md` and new `ens-registration.md`. No lock change.
- Next concrete action: review this candidate, supply the actual Sepolia parent and
  approve expiry/recovery policy, prepare unsigned setup using the documented command,
  then execute an operator-signed real ENSv2 compatibility smoke. Do not merge W1 wholesale
  or route a named poll into mock PollDetail to make the gate appear complete.
- External setup: Alejandro selects/controls the native ENSv2 parent, creates/links its
  registries, chooses the operator/expiry and signs deployment/role grants privately.
  Hermes/W1 integration must supply the participating-account sender and sponsorship
  rules. S3.2 must provide bound real metadata and a voting route consuming the target.
