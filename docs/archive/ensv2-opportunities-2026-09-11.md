# ENSv2 opportunities for VenekoVox

> **Background research only (2026-09-11).** This note is not implementation
> authority. Named-account onboarding is the S1.1 slice that shipped in code on
> `feat/s11-ensv2-named-accounts`. Hermes WP5 Graph composition, named poll
> publications, bilingual aliases, community directories and mainnet owned-name
> composition remain deferred, not scheduled.

Date: 2026-09-11. Owner: Codex / Astra. Task: S1.1 design, with S3.2/S4/S5 dependencies.
Status: research and proposal, not an accepted implementation or deployment decision.

## Recommendation

Build a native Sepolia ENSv2 poll namespace, demonstrate narrowly delegated record
editing, and add bilingual aliases to one real configured poll. This provides useful
navigation and a visible division of publishing responsibilities. Keep optional public
profiles, community namespaces and named research agents as explicit extensions.

The core story is: a community publishes a poll under a recognizable name; collaborators
can maintain particular public records; participants reach the exact same ballot through
different names; eligibility and ballot processing retain their existing checks.

This is an expansion of the design space beyond Hermes's WP5 display brief. It does not
authorize replacing Cursor's plan, registering names, or changing the live test instance.

## Research and repository baseline

### Follow-up: named accounts and the three prize-linked components

The user's subsequent direction is that every user should have a named account.
Treat that as the onboarding target, superseding this proposal's earlier optional-name
framing. It does not authorize public participation directories or make ENS eligibility.
Freshly fetched main `95e04160` still has the read-only ENS discovery files; the naming
registrar remains in the separate candidate branch. No live naming deployment was
verified in this review.

Recommended arrangement (illustrative parent):

- `people.venekovox.eth`: one application-level UserRegistry for persistent account
  names, such as `alejandro.people.venekovox.eth`.
- `polls.venekovox.eth`: another UserRegistry for named polls. A poll is initially a
  name entry, not a separate deployed registry. Add its own subregistry only if it
  needs independently managed children such as publications or resources.
- Each named account uses a Permissioned Resolver with an explicit owner/admin
  policy; use EAC to delegate only selected profile keys to the application. Control
  of a registry token alone does not confer writes to another account's resolver.

The unmerged `VenekoVoxNames` calls the ENSv2 registry but installs itself as a custom
resolver and mints with zero owner roles. It is not already an integration of the
standard Permissioned Resolver's editable profiles. Reworking that resolver model,
record writes and recovery is required; simply enabling its UI is insufficient.

Proposed onboarding: obtain the actual participating account; choose or accept an
available pseudonym; register it and configure records; verify receipt, registry state
and fresh resolution; then start the short-lived passport/grant/join sequence. Returning
accounts recover the existing name. Failed provisioning stays visibly pending and can
be retried without duplicate claims. It must not be reported as a registered ENS name
until on-chain checks pass. Do not change the proven voting contracts to require ENS.

An on-chain registration is public. Explain that the name links to account history;
keep passport attributes, unique identifiers and ballot contents out of all records.
The name identifies an account, not a verified unique person. Per-poll account aliases
are unnecessary for this target and can increase public linkage and transaction costs.

Demonstrate all three components together: register a native subname in UserRegistry;
let its owner edit a profile record in Permissioned Resolver; grant the application
only one text-key permission, prove other writes revert, revoke the grant and prove
the permitted write now reverts too. Record hierarchy/upgrade/expiry powers honestly.
Run this in isolation from ongoing vote/tally testing.

The official documentation describes ENSv2 as deployed on Sepolia with interfaces still
subject to change. Its changes include hierarchical registries, a common permission
system, and per-account resolvers. A registry stores names and ownership; a resolver
answers queries about a name, such as its address or public text records.
[ENSv2 overview](https://docs.ens.domains/ensv2/overview/)

The ENS continuity prize requires a functional ENSv2 integration on Sepolia that improves
an existing project. Mainnet name display alone does not demonstrate this. Prize success
is not guaranteed by any design here.
[Official ENS prize page](https://ethglobal.com/events/ethonline2026/prizes/ens)

I followed that page's workshop link, but the video could not be retrieved. This research
uses ENS's written primary sources; it does not claim to summarize the video.

Repository evidence:

- Local checkout: clean `main` at `be3665ac` before this documentation change.
- Fetched `origin/main`: `e5ed04ca`; includes WP4, Studio deployment reporting,
  vote-provider fixes and new debug reporting. Those live claims were not reproduced here.
- [Existing resolver](../apps/front-end/src/ens/pollName.ts) already reads
  `xyz.venekovox.poll`, checks chain/MACI/Poll identity and reads the voting window at a
  checked block. The [named-poll page](../apps/front-end/src/pages/NamedPoll.tsx) remains
  read-only, without a ballot handoff. These files were inspected on fetched main too.
- `codex/ens-registration-v2` contains a candidate `VenekoVoxNames` registrar/custom
  resolver and UI. Its documentation explicitly limits its tests to registry doubles;
  it does not establish live ENSv2 permission compatibility, recovery or permanence.
- The fetched lockfile resolves ethers 6.15.0. ENS currently lists ethers 6.17.0 or an
  ENS patch for automatic Universal Resolver support. Our explicit ABI/CCIP reader is
  a separate implementation: its older ethers version alone does not prove it broken.
  Test it against native v2 names before deciding on an isolated dependency update.
  [Library readiness](https://docs.ens.domains/web/ensv2-readiness/)

## Candidate designs

All names below are illustrations; ownership and availability have not been checked.
`venekovox.eth` stands for a native ENSv2 parent controlled by the operator.

| Idea                         | Participant or operator benefit                      | ENSv2 feature                              | Relative scope                        |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------ | ------------------------------------- |
| Named poll publications      | Open/share a specific checked ballot by name         | Native subnames and resolution             | Small–medium; recommended first       |
| Delegated public editing     | Let collaborators update only their assigned records | Per-record permissions                     | Medium; recommended with first slice  |
| Bilingual aliases            | English and Spanish links reach one canonical poll   | Record aliasing                            | Small addition after resolution works |
| Community namespaces         | Each organization manages its own poll directory     | Separate subregistries                     | Medium–large extension                |
| Persistent public pseudonyms | Optional continuity across public activity           | Configurable registration/ownership policy | Larger; recovery decision required    |
| Named research agents        | Discover an accountable public-data assistant        | Scoped records and agent discovery         | Later S5 extension                    |
| DNS integration              | Reuse a familiar community web domain                | DNSSEC-backed ENS resolution               | Optional feasibility spike            |

### 1. Named poll publications

Example: `france-2027.polls.venekovox.eth`.

The participant opens the name and sees the question, candidate list, voting window,
publisher and the underlying Poll address. A continue button enters the configured
poll only after confirming that its chain, MACI, Poll address and poll ID all match.
An arbitrary resolved poll remains a details-only page until multi-poll routing exists.

Use the existing strict `xyz.venekovox.poll` record unchanged. Add separately versioned
metadata rather than silently adding fields its parser rejects. Proposed records:

| Record                         | Purpose                                        | Integrity rule                                                          |
| ------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `xyz.venekovox.poll`           | Existing chain/MACI/Poll reference             | Match on-chain `getPoll` and the selected application context           |
| `xyz.venekovox.metadata`       | URI and digest of a public, versioned manifest | Check digest against the reviewed application release                   |
| `xyz.venekovox.description.es` | Optional Spanish explanatory text              | Supplemental copy only; cannot redefine ballot choices                  |
| `xyz.venekovox.results`        | Reference to a released public result artifact | Independently validate result provenance; ENS is not tally verification |

These additional keys are proposed application conventions, not ENS standards.

For WP6, bind each candidate's stable option index and name into the reviewed manifest.
Live avatars, biographies or an ENS name changing hands must not alter what option 0
means halfway through a poll. Do not claim candidate endorsement merely because an
operator assigned their name to an option.

A content digest detects changed bytes; it does not prove who authorized them. For the
first slice, the release-pinned manifest is an explicit operator trust assumption.
A later independently anchored publication can reduce that assumption. A mutable name
is a convenient pointer, never the permanent identifier of a ballot or receipt.

Native subnames can use a parent resolver when appropriate; queries must follow the
Universal Resolver's hierarchy/extended resolution path. A shared resolver must still
return records for each requested full name; inheritance does not automatically copy
the parent's text records onto every child.
[Universal Resolver V2](https://docs.ens.domains/ensv2/universal-resolver-v2/)

Acceptance: native registration evidence; fresh name lookup; correct ballot handoff;
unsupported/mismatched target rejected; changing a name cannot change an active ballot;
the direct configured-poll route remains usable during ENS failure.

### 2. Delegated public editing

Example: Alejandro controls publication, a translator maintains Spanish explanation,
and a release publisher maintains a results pointer.

ENSv2 supports grants for an individual text key on an individual name through
`authorizeTextRoles`. Use the resolver's scoped authorization methods, rather than
granting a collaborator control over every name or every text field.
[Permissioned Resolver](https://docs.ens.domains/ensv2/permissioned-resolver/)

Proposed permission matrix:

| Actor                   | Allowed                                             | Must be rejected                                     |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Translator              | Update this poll's supplemental Spanish description | Change poll target, options, results or another poll |
| Results publisher       | Update this poll's public results pointer           | Change target, eligibility policy or name ownership  |
| Observer/agent          | Read public records                                 | Any write                                            |
| Namespace administrator | Manage explicitly documented operational settings   | No implicit authority over MACI contracts            |

Keep actual ballot wording/option mapping pinned even if supplemental copy is editable.
Make the demo's decisive moment an unauthorized target edit reverting on-chain, followed
by a permitted description edit succeeding and appearing in the app.

Root roles are broad powers, and admin roles can restore permissions. Our tests must
check every effective grant path, not just whether one visible grant was removed.
[Enhanced Access Control](https://docs.ens.domains/ensv2/enhanced-access-control/)

For the hackathon, describe retained administration honestly. Do not call a record
immutable merely because a translator cannot edit it; registry pointer changes,
resolver administration and upgrades are additional control paths.

### 3. Bilingual aliases

Example: `francia-2027.polls.venekovox.eth` and
`france-2027.polls.venekovox.eth` open the same canonical poll.

Record aliasing shares records between names using one resolver instance. It is read
through extended resolution, not a direct `text()` call against the alias namehash.
Alias changes require root-level alias authority. Avoid cycles and keep aliases
operator-maintained for the first slice.
[Alias behavior](https://docs.ens.domains/ensv2/permissioned-resolver/#aliasing)

The app shows the canonical poll and lets the visitor choose language. Aliases do not
translate records: Spanish and English content still need separate fields/artifacts.
Both names must produce the same checked Poll identity and pinned option mapping.
An alias change during a session must not redirect an already prepared vote.

### 4. Community-owned poll directories

Example: `housing.polls.caracas.venekovox.eth` and
`transport.polls.melbourne.venekovox.eth`.

A subregistry is a community's own directory contract beneath the shared parent.
Communities can manage naming independently; VenekoVox can become a client for multiple
publishers. Namespace aliasing can mount a shared directory beneath multiple parent
names, useful for a partner brand, but canonical identity must stay explicit.
[Registry hierarchy](https://docs.ens.domains/ensv2/registry-hierarchy/)

This grants control of naming, not authority to deploy accepted polls or verify humans.
Those permissions remain separately reviewed application policy. Begin with one
community and one allowed MACI deployment.

Choose between a managed directory, where the operator retains intervention powers,
and an independently controlled namespace. ENS provides configuration patterns, but
those labels depend on actual deployed permissions.
[Registry template](https://docs.ens.domains/ensv2/registry-template/)

Acceptance: community A can maintain A's name records but cannot change B's; removal
of a parent link is detected; existing receipts retain their original chain identity.

### 5. Persistent, optional public pseudonyms

Example: `alejandro.people.venekovox.eth`.

This aligns with D04 and can support public discussion, authored polls and an optional
profile. Offer it separately from eligibility, explain address-history linkage, and
allow a person to vote without a public profile. Do not automatically publish a named
participant directory as part of profile creation.

A registrar applies claim policy; a registry stores the name. Reuse and reassess the
existing candidate rather than designing another overlapping registrar. One claim per
address does not mean one claim per human. If a future product needs a uniqueness-gated
name, it needs a separately scoped authorization design; never reuse a live poll grant
or expose a passport identifier in ENS.
[Registrar responsibilities](https://docs.ens.domains/ensv2/tutorial-contract-developers/)

ENSv2 can withhold transfer rights, but ordinary-transfer restrictions do not establish
absolute permanence. Parent control and expiry matter. ENS's definition of emancipation
also requires a verified implementation and absence of dangerous root powers; a custom
registry cannot simply claim that property.
[Ownership and emancipation](https://docs.ens.domains/ensv2/permissioned-registry/)

Recommended longer-term recovery: keep the name owned by a recoverable account, changing
its authorized signers rather than routinely transferring the name. This is a wallet
architecture proposal, not functionality ENS supplies automatically. Account recovery
still does not recover MACI voting keys. Prototype alternatives before deploying D04's
nontransferable/no-expiry policy.

### 6. Named public-data agents

Example: `observer.agents.venekovox.eth` answers questions about public poll metadata,
indexed joins and released results, with citations and indexing freshness.

ENSIP-26 proposes `agent-context` and `agent-endpoint[mcp]`/`[a2a]` for discovery;
it is currently marked draft. Treat retrieved descriptions as untrusted data, not
instructions to a client. Discovery does not itself authorize tool calls or signing.
[ENSIP-26](https://docs.ens.domains/ensip/26/)

If using an on-chain agent registry, ENSIP-25 describes an explicit association check
from that registry entry to ENS. It is also draft and verifies association, not the
agent's accuracy or honesty.
[ENSIP-25](https://docs.ens.domains/ensip/25/)

Start read-only. A future report publisher can receive one output-record permission,
without poll-target or eligibility authority. This fits S5 after a useful public-data
consumer exists; a named empty endpoint is not a meaningful agent demonstration.

### 7. Familiar DNS names

`uxisnear.com` could be evaluated as a public discovery alias, separately from its
ZKPassport origin role. ENSv2 can resolve DNSSEC-backed domains using ENS-specific TXT
configuration. Existing A/CNAME records and origin-validation TXT records are not that
configuration. DNSSEC support, zone control and Sepolia behavior remain unverified.
[DNS resolution](https://docs.ens.domains/ensv2/dns-resolvers/)

The current parser intentionally accepts only `.eth`; enabling DNS names would require
an explicit normalization/UI extension. Use a disposable subdomain for a spike and
leave the active passport origin's routing and verification records unchanged.

## Implementation sequence alongside live testing

1. **Isolated proof of compatibility.** Fresh worktree from current main, dedicated
   ports and public test configuration. Confirm a native v2 parent, current ABI and
   resolver behavior. No shared lockfile upgrade in the live-testing checkout.
2. **Read-only publication prototype.** Configure one native poll name, read existing
   poll reference plus proposed public metadata, and show all validation outcomes.
   Use separate ENS modules and the current `NamedPoll` page as the starting point.
3. **Permission/alias demo.** Use disposable test accounts controlled by the operator
   for the permitted/forbidden writes. Demonstrate both language names resolving to
   the same target. No eligibility, voting or funded-account secrets enter the design.
4. **Controlled integration.** After a live-testing checkpoint, add the exact-context
   ballot handoff and rerun the normal vote/recovery smoke plus ENS failure cases.
5. **Optional follow-ons.** Community directory first; profiles only with recovery and
   public-linkage decisions; agents when S5's consumer can answer useful questions.

Steps 1–3 can proceed without changing the active live test. Approximate engineering
scope is several focused days, contingent on native setup and beta compatibility;
this is not a half-day promise or an estimate for all seven designs.

Do not redeploy the MACI contracts, rotate eligibility configuration, restart the active
backend or repoint its WP4 Graph endpoint for this prototype. No ENS lookup is inserted
into grant issuance, proof preparation, transaction submission or receipt recovery.

## Indexing and acceptance evidence

The first slice needs resolver reads and a small configured name list, not a global
ENSv2 indexer. WP5's mainnet owned-name composition may coexist, but is a different
dataset from native v2 namespaces. No usable official v2 subgraph was verified here.

If community enumeration becomes necessary, index only the selected registries first.
Use chain and registry alongside label/resource identity; token IDs change with roles,
resources change on re-registration, and alias-aware resolution can differ from stored
records. Handle deployment/linking history and indexing freshness explicitly.
[ENSv2 indexing](https://docs.ens.domains/ensv2/indexing/)

Collect public evidence for native registration, resolver writes, successful resolution,
permission rejection/revocation, alias equivalence and the real ballot handoff. Test
stale account/navigation responses, wrong chains, malformed records, changed targets,
parent expiry, unsupported resolvers and ENS outages. Existing MACI/eligibility checks
must remain independently effective. A displayed result link never closes S4's tally gate.

## Handoff

This pass researched official documentation and inspected source, including fetched
main and the unmerged registrar candidate. No runtime tests, wallet operations, native
registrations or deployments were performed. The proposal does not close an acceptance
gate. Changes are documentation only and uncommitted; no push or PR was made.

Next decision: adopt named poll publication + scoped editing + aliases as the first
ENSv2 slice, then turn its permission matrix and metadata integrity rules into a bounded
implementation spec. Parent name selection and any signing remain with Alejandro.
