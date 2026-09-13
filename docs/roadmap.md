# Roadmap, acceptance gates and decisions

## Full journey presentation and merge gate — 2026-09-13

Extended accepted collage styling through naming, passport verification, ballot/
receipt/results, ENS discovery and the legacy creation/discussion previews.
Only markup/styles and illustration imports changed; existing handlers, account
binding, verification, storage, receipt recovery and tally logic are preserved.
Legacy sample pages explicitly disclose their prototype status.

Build passed and frontend unit tests passed 122/122. Browser checked naming,
eligibility (including 390px overflow/disclosures), unconfigured ballot/results,
and discovery validation/dark theme. This is local UI evidence, not a live vote.
Existing optional SDK export and bundle/Browserslist warnings remain.

User authorized commit and push of the design branch. Merge compatibility against
`origin/main` at `cef72d13` found existing ENS registration/wallet/naming, App routes,
environment example, ENS tests and canonical-doc conflicts. Do not resolve these
by blindly choosing ours/theirs. The tally closing is not a prerequisite for the
presentation merge; reconciling concurrent ENS implementations is. Preserve the
operator's live configuration and do not overwrite the other worktree.

## Accepted collage direction — 2026-09-13

Alejandro approved the new object-led resistance collages. This supersedes the
cheerful companion imagery and tabbed homepage described below. The original hero
is preserved. The homepage now leads with the flagship and three teaser cards,
then separate ENSv2, ZKPassport, MACI/Ethereum and The Graph chapters, followed by
the problem section. Eight new labeled AI illustrations replace earlier companion
art through the shared component. [Handoff and evidence](design/civic-story-2026-09-12/README.md#accepted-collage-direction--2026-09-13).

Worldwide participation is the requested product direction, superseding the prior
restricted flagship audience as a design requirement. It remains **planned**, not
live: neither backend eligibility nor the existing descriptor was changed. Align
and validate the actual policy/configuration before advertising availability.
The local explorer remains unconfigured. Frontend build passed; desktop/mobile
layout, disclosure keyboard activation and CTA navigation checked. No live proof,
vote, tally, deployment or publishing. Judge worktree changes remain uncommitted;
other work, original images and video assets are preserved.

## S3.2 imagery extension — 2026-09-12

User approved the editorial cover and asked to extend its imagery. Astra added
four original companion collages, a shared accessible/lazy-loaded EditorialArt
component, and warm light/dark tokens across the poll explorer, naming,
eligibility, ballot and journal. Homepage gains two further illustrated sections.
Build passed with existing warnings; desktop/mobile browser review passed. Real
unconfigured states remain. No protocol logic, deployment, live vote or publishing.
Uncommitted judge worktree delivery; existing cover/video work preserved.
[Details, provenance and pickup](design/civic-story-2026-09-12/README.md#imagery-extension--2026-09-12).

## Presentation decision — 2026-09-12

User requested an authored, quirky civic storytelling experience inspired by y-n10.
S3.2 now has a local editorial cover candidate: authority → collective voice →
technology exhibits → existing poll explorer. Original AI illustration is labeled;
no invented historical attribution, poll availability or verified results. This
reversible presentation choice changes no Stage 1 gates or technical boundaries.
[Implementation and verification](design/civic-story-2026-09-12/README.md).

Status authority: [status.md](status.md). Call-by-call map: [journey-map.md](journey-map.md).
Dependencies below prevent parallel implementations from making incompatible
identity, wallet or schema assumptions. Milestones are outcome gates, not claims of
scheduled delivery.

## Three delivery stages — accepted 2026-09-07

Alejandro approved the following sequence. This is the active prioritization, superseding
earlier same-day instructions to advance demographic implementation alongside core polling.
These product stages do not renumber the existing S-task IDs or M1–M4 milestones.

| Stage                                        | Outcome                                                                                             | Acceptance and scope                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Private, verifiable polling **(active)** | One complete real polling journey using the existing MACI foundation and one selected identity path | Real-document eligibility, actual-account enforcement and negative tests; real poll metadata/mode/dates and proving assets; encrypted submission, receipt verification, refresh/reconnect, and proof-verified overall results with provenance. State coordinator/issuer trust honestly. Maps to M1 and the supporting S2.1/S2.2/S3.1/S3.2/S4.1 work. |
| 2 — Rich demographic results                 | Useful age, official document sex/gender and verified geography breakdowns                          | Authenticate attributes against final counted ballots; define operator visibility, consent, retention, missingness and aggregate release protection. Distinguish operator-computed from proof-verified reports. Existing DA design is retained; implementation follows Stage 1.                                                                      |
| 3 — Reduce single-operator trust and failure | Stronger independence from our eligibility issuer, coordinator and private-data infrastructure      | Evaluate contract-verifiable eligibility, participant-held credentials, distributed storage/private computation, independent operators and recovery. Demonstrate outage/collusion assumptions. A database replacement alone is not completion.                                                                                                       |

Stages 2 and 3 remain product commitments in direction, not dependencies for Stage 1
or claims of solved architecture. Stage 1 is a usable product milestone, not a mock demo.
Preserve extension boundaries without collecting speculative demographic data or adding
distributed infrastructure now. Hermes's bounded Self/ZKPassport comparison informs
the Stage 1 identity choice; it is not a requirement to ship two providers. VicRoads,
vlayer/TLSNotary and private-database exploration remain documented follow-up options.

## Task IDs

Every task is `S<stage>.<n>` — the stage number from [journey-map.md](journey-map.md).
Legacy IDs appear in brackets for continuity with older commits.

| New ID | Legacy | What it is                                     |
| ------ | ------ | ---------------------------------------------- |
| S2.1   | P2     | Self → policy authorization bridge             |
| S2.2   | W1     | Wallet / smart-account / sponsorship adapter   |
| S3.1   | P1     | Atomic vote flow, hydration, receipt truth     |
| S3.2   | P3     | Real poll metadata and lifecycle               |
| S4.1   | P4     | Verified tally → results                       |
| S1.1   | E1     | ENS profiles                                   |
| S5.1   | T4     | Standardized schema                            |
| S5.2   | T5     | Live comparative query                         |
| S5.3   | T6     | Agent access                                   |
| S5.4   | A1     | Controlled creation API / x402                 |
| S0.1   | T1/T2  | Subgraph rebase + network config (**shipped**) |

`G01`–`G13` (gap IDs) and `D01`–`D17` (decisions) are unchanged — they are
referenced in commits and code comments.

## Dependency graph

```
  S0.1 subgraph base ──────────────────────────┐  SHIPPED 32cc13d26
                                               │
  S3.1 atomic vote ──┐                         │
                     ├──> M1 complete journey  │
  S2.2 wallet ──> S2.1 eligibility ──> deploy ─┤
                                               │
  S3.2 real poll ──────────────────────────────┤
                                               │
  S4.1 verified results ───────────────────────┘
                     │
                     ├──> M2 usable platform ──> M4 informed community
                     │
                     └──> S5.1 schema ──> S5.2 query ──> S5.3 agents
```

## M1: one complete, honest polling journey

| Work                      | Current status                                                                                                                                                       | Completion gate                                                                                                                                                                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3.1 reliable submission  | Core flow implemented; poll-publication verifier and unit race harness added                                                                                         | G11 resolved; **G02 partial** (direct EOA `publishMessage` + event; no smart-account confirmation; not live-verified); **G03 partial** (operation revision + owned in-flight lock + unit race harness; no browser mount harness/live smoke yet); remaining: real submit → refresh → reconnect smoke, key-scope decision |
| S2.2 wallet compatibility | Separate W1 experiment branch; not merged into this baseline                                                                                                         | EOA and candidate smart account use actual caller consistently; viable sponsorship and SDK path demonstrated before S2.1 binding is frozen                                                                                                                                                                              |
| S2.1 eligibility          | Product HTTP + Auth mounted on this branch; D18 real-document grant still trial-server evidence; join `sgDataArg` plumbed; WP0 policy undeployed; in-memory sessions | G01 durability still open; eligible HTTP negatives on the mounted router; G/H (on-chain tag consume + second-wallet) gated on WP0                                                                                                                                                                                       |
| Deployment/proving assets | Existing poll unsuitable for current demo                                                                                                                            | G07/G08 resolved; explicit windows/mode/policy; browser assets served; public manifest verified                                                                                                                                                                                                                         |
| S3.2 real poll experience | Partial: operator descriptor + on-chain window, option count and mode; flagship preset ready, not deployed | G05: one configured poll; correct options; unconfigured/mismatch/unavailable distinct from Closed |
| S4.1 verified results     | Protocol machinery exists, integrated path pending                                                                                                                   | G06/G13 resolved; on-chain verified aggregate → live query → UI, with provenance and finality                                                                                                                                                                                                                           |

M1 signoff requires one real-document Self verification, one eligible submission,
rejected unauthorized participation, refresh recovery and a final verified result.
Record public transaction evidence, versions, environment and remaining limitations.
Mock-passport staging is useful preceding evidence, not the entire signoff.

## M2: usable platform

Complete sponsored onboarding if S2.2 only proved compatibility; implement real
creation/discovery, S1.1 ENS profiles and durable poll metadata. Acceptance includes
a new zero-ETH participant, a creator who can publish a valid poll, and returning-user
recovery. Do not block M1 on a discussion board or broad automated creation.

## M3: standardized data and agents

- **S5.1:** v2 schema, mappings, compatibility note and shared-query tests implemented in the S5 patch; WP4 adds MACI `StateLeaf` (SignUp) for join proofs. Upstream acceptance not claimed.
- **S5.2:** comparative read client implemented. **Studio/live deploy COMPLETE 2026-09-11** — deployment `QmeBkGteYdc7bQeHD2FneLBG1dm5MHcMbvgYPiKxAfqDeM`, version label `wp4-state-leaves`, endpoint `https://api.studio.thegraph.com/query/1758839/venekovox-governance-v-2/wp4-state-leaves`, synced with `hasIndexingErrors: false` and serving indexed `StateLeaf` rows that match the on-chain root (see [status.md](status.md)). Local correctness for StateLeaves is the subgraph/backend/frontend tests above.
- **S5.3:** read agent/MCP answers a real question using live Graph data with citations, finality and methodology limits. Compare useful behavior against a baseline.
- **S5.4:** constrained creation API, payment/idempotency handling, then actual Bazantic gateway/Recipe integration and controlled comparison evidence.

S5.1 design can proceed while S2.1 is being resolved, but must use the S4.1 result
model and preserve product meaning. A schema file, MCP connection or paid endpoint
alone is not a completed user outcome.

## M4: informed participation

Add discussion and resource panels with moderation, source attribution, abuse
controls and privacy separation from ballots. Explore news-triggered drafts before
autonomous publication. Reassess privacy and representativeness claims as audiences
and datasets grow.

## Demographic analytics (product direction)

2026-09-07: Alejandro prioritizes political polling in the US, Australia and European
countries, with citizenship eligibility and age/geography/optional gender analysis.
Alejandro's same-day correction selects verified passport nationality as the practical
citizenship proxy (no separate non-citizen-national check), and official document
sex/gender with no self-described override. Use official sources for pilot demographic
evidence; missing attributes remain unavailable. This supersedes the earlier proposed
self-reported gender/residence fallback and additional citizenship-evidence gate.
The [political pilot](demographic-analytics-spec.md#political-polling-pilot--product-direction-updated-2026-09-07)
is retained as Stage 2 design, following private, verifiable polling. Proposed first
dimension: age bands for one national opinion poll; regional evidence follows.
No demographic proof, production collection or provider switch is approved by the
existence of this scope. M1 and authenticated counted-ballot/release gates remain.

Privacy-preserving demographic research is in long-term product scope per
[demographic-analytics-spec.md](demographic-analytics-spec.md). DA0 (bounded design,
optional synthetic demo) may run alongside the critical path; DA1–DA3 follow M1. A
spec's existence does not mark any roadmap feature implemented — the M1 acceptance
gates above are unchanged, and demographic ballot results must never be claimed until
authenticated attribute-to-counted-ballot linkage and release protection exist.

## Next implementation order

Latest decision, 2026-09-07: execute Stage 1 first under the accepted three-stage sequence
above. [Data and tally architecture](data-and-tally-architecture.md) retains the deeper
design for subsequent stages; PostgreSQL and distributed alternatives are proposals,
not selected product dependencies. Direct verified Tally reads can precede Graph ingestion.

2026-09-07 update: Alejandro approved the bounded S2.1 Self Enterprise/ZKPassport
comparison and proposed a VicRoads zkTLS licence-source feasibility slice. Execute the
[trial specification](build.md#s21-provider-comparison-trial--approved-scope-2026-09-07)
before freezing further provider-specific eligibility assumptions. D02 remains the
current baseline; this approval does not select a replacement or approve cross-provider
identity equivalence. M1 gates remain unchanged. Compare total operating cost and trust,
not only AI-assisted integration effort. Open-source contribution is a supported avenue
when the trial produces a concrete reusable improvement; no upstream acceptance claimed.

1. Repair hydration/receipt truth and define MACI-key migration behavior (S3.1 gaps). Poll-publication verification and a unit race harness are in; live submit→refresh smoke and the React mount harness remain.
2. Run the bounded S2.2 caller/SDK/sponsorship compatibility spike; record the proposed account model.
3. Resolve S2.1 policy/uniqueness/ballot-mode decisions; implement enforcement and negative tests.
4. Provision assets and deploy a correctly configured poll; replace M1 mock metadata.
5. Complete tally → publish verified overall results → UI and capture full M1 evidence. Use consistent-block direct Tally reads before Graph ingestion if that completes the journey sooner; retain the subgraph as the public read layer.
6. Expand ENS, standardized queries and agents against this working journey; prepare prize-specific evidence.

Update this sequence if the team chooses a different critical path. Record the reason
and dependencies preserved. Confirm the event deadline/timezone and prize stacking
with official organizers before assigning calendar commitments; this document does not
establish those rules.

---

# Decision register

These decisions preserve product context across models and interruptions. "Accepted"
records direction from Alejandro or the visible planning context; it does not claim
implementation.

| ID  | Status                                                      | Decision and reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D01 | Accepted                                                    | Product first: verified-human civic polling is the core. Prize integrations serve the participant journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D02 | Superseded → Enterprise accepted (itself superseded by D17) | On 2026-09-05 Alejandro explicitly approved investigating and adapting P2 to Self Enterprise after confirming the official Self Pass legacy notice. New identity work uses Enterprise; old Pass code is migration debt, not the selected path. This supersedes the former prohibition on org/flowId/API-key setup. See build.md A1. On 2026-09-08 D17 locked Stage 1 identity to ZKPassport and left Enterprise unmounted; the shared authorization boundary (challenge → EIP-712 grant → policy enforce) remains provider-agnostic.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D03 | Accepted                                                    | MACI supplies encrypted voting and proof-verified tallying. Describe coordinator trust and metadata visibility honestly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D04 | Accepted direction                                          | Persistent per-person ENS subnames, not a fresh name for every poll. Desired nontransferability/no expiry require contract-level feasibility and recovery decisions. ENS does not grant eligibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D05 | Accepted direction                                          | Reduce wallet/gas friction. Keep injected fallback. Settle smart-account caller compatibility before locking S2.1 contract binding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D06 | Candidate                                                   | Privy is the first sponsored-execution experiment; exact stack remains provisional. S2.2 (legacy W1) is active on a separate branch. Require E1–E6 evidence before production approval; see status.md for branch context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D07 | Accepted                                                    | Agents are a downstream layer, initially querying public data and later using controlled creation. No agent casts a person's secret ballot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D08 | Accepted                                                    | M1 may use an operator-created real poll. A working creation form is not required to prove the first complete journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D09 | Accepted                                                    | Keep keys/secrets out of agent chat. Alejandro controls funded deployer and voter accounts; agents prepare reproducible commands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| D10 | Accepted gate                                               | Mock-passport staging is clearly labeled and exercises the selected provider's actual proof flow (ZKPassport per D17); one real-document verification is required before M1 signoff. A fake UI success is not evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D11 | Candidate implemented; deployment unresolved                | Issuer-backed eligibility policy and Enterprise session/webhook adapter implemented in the P2 patch for evaluation. No deployed approval implied: issuer custody, config, recovery and live integration remain gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D12 | Proposed, unresolved                                        | Define uniqueness scope, eligibility attributes, poll mode/credits/options, expiry/replay rules and account/key recovery before deployment. Civic "one person, one choice" is not automatically achieved by default QV settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D13 | Proposed, unresolved                                        | Choose tally publication/indexing mechanism; current Tally contract has no dedicated result events. See [journey-map.md §6](journey-map.md) for the two options.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D14 | Implemented candidate                                       | Add a Messari-derived partial governance projection while retaining native MACI entities. Use client composition across separate Graph endpoints. Token/delegate data and private tallies are not fabricated; upstream acceptance and live evidence remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D15 | Deferred                                                    | Discussions/resources after reliable polling; moderation and separation from ballots are required. Vote-reason harvesting, demographic microsegments and monetization of individual opinions are outside initial scope. See D16 for long-term demographic analytics direction.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| D16 | Accepted direction                                          | Privacy-preserving demographic analytics is in long-term product scope (DA0–DA3 in [demographic-analytics-spec](demographic-analytics-spec.md)). Analyses must be authenticated to defined populations (registration/joined/submitted/counted), release-protected, and versioned; raw individual attribute-choice linkage, opinion monetization and ballot attribution remain excluded. DA0 may run alongside this week's critical path; DA1+ follow M1. Supersedes any reading that demographics are permanently excluded.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D17 | Accepted (2026-09-08)                                       | Stage 1 identity provider **locked: ZKPassport** (`@zkpassport/sdk@0.16.2`). Uniqueness = salted (`NullifierType.SALTED`) + `.facematch("strict")`; scope/domain frozen in the eligibility manifest (`venekovox-stage1`); tag path = canonical decimal `uniqueIdentifier` → HMAC → `bytes32 identityTag` (reuses P2 `usedIdentityTags`/`usedAccounts`); no raw `uniqueIdentifier` on-chain; `uniqueIdentifierType` pinned in `configId`; salted↔scoped mix rejected at verify; `SALTED_MOCK` accepted only in devMode (SDK already rejects outside dev); fallback to scoped non-salted allowed only if D10 FaceMatch/device friction fails — PM decision + new record, never a silent mid-poll flip. Supersedes D02's provider selection for new identity work: Self Enterprise remains implemented but **unmounted**; TLSNotary/vLayer stay a backup spike. Acceptance = D10 mock suite + one real-document session (A–I). Negative coverage (wrong account / replay / expiry / bypass / unknown scope) is provided by the shared eligibility boundary (authorization.ts, accountControl.ts, SelfEligibilityPolicy.enforce). Sources: WP1 acceptance addendum 2026-09-08 (architect) + Hermes SDK/repo verification same day.                                |
| D18 | Achieved (2026-09-09)                                       | **D10 real-document session PASSED on the D17 salted lock.** Real passport + ZKPassport app 1.3.1 (current) + Developer Options OFF flowed A–F: chip bind → salted proof generated on-device → server-side authoritative verification (real SDK `verify()`) → EIP-712 grant issued (configId `0x5036bfca…` = keccak("venekovox-stage1-salted-v1"), action = `signup`, identityTag = HMAC of the real `uniqueIdentifier`). Two upstream/device findings unblocked it: (1) ZKPassport dashboard project **Allowed origins** gates live proof generation — unknown origins crash the app silently at "generating proof"; fix = verified subdomain (`app.uxisnear.com`) via DNS TXT + CNAME to `claudios-mac-mini.taila56fc2.ts.net`, add to allowed origins, serve the client from the matching origin; (2) esm.sh cannot serve the `@aztec/bb.js` Worker asset, so the SDK's browser-side `onResult` never fires — the browser is now a pure relay (override `zk.handleResult` to hand proofs/result to the server; commit `086c1b089`). Remaining acceptance: **G (join, tag consumed) and H (second-wallet reject) need WP0** — fresh poll + `SelfEligibilityPolicy` bound and deployed. Never silently flip to scoped: the salted lock produced a real grant. |

## Superseded assumptions

- "Schema design is done; just implement every prize" does not override M1 integration gates.
- "Self verified in browser" does not mean contract eligibility is enforced.
- "Refresh restores a receipt" does not mean the receipt was checked on-chain.
- "Poll-0 was once open" is contradicted by the reported zero dates; recheck the selected poll.
- "Wallet recovery restores everything" omits the independent MACI key.
- "The Graph has $15k, therefore this project can win $15k" ignores track eligibility, award splits and stacking rules.
- "All deployments in old JSON/READMEs are current" is false. Validate a public manifest against chain state.

## Recording a new decision

Add date, decision owner, alternatives, chosen behavior, trust/privacy implications,
affected source paths, acceptance evidence and superseded IDs. If a choice is
reversible implementation detail, use engineering judgment and record it. If it
changes eligibility, public linkage, key custody or deployed policy semantics, obtain
Alejandro's decision on a concrete proposal before final deployment.

### S1.1 delivery update — 2026-09-11

Two implemented ENS slices, one deferred lane:

| Lane                                                             | Status                                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Named poll discovery (`/discover`, `xyz.venekovox.poll`)         | On main; read-only; leave the parser unchanged                                  |
| Named accounts (`/names`, Permissioned Resolver + EAC theme key) | This branch; Sepolia ENSv2; not live-registered until Alejandro deploys parents |
| WP5 mainnet Graph composition / poll aliases / directories       | Deferred, not scheduled                                                         |

Personal names are optional public labels for wallets. They are not eligibility.
See build.md A3 and [ensv2-opportunities-2026-09-11.md](ensv2-opportunities-2026-09-11.md)
(background research only).
