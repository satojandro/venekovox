# Data ownership, vote processing and demographic results

Architecture proposal by Astra, 2026-09-07. Source reviewed on main
`81950b4215a313649ab7f5d6b0b6dedc6269a96f`; existing uncommitted product/trial notes
preserved. This document makes implementation boundaries concrete. It does not claim
that storage, demographic binding or result delivery is already deployed.

**Priority update, accepted 2026-09-07:** follow the
[three-stage roadmap](roadmap.md#three-delivery-stages--accepted-2026-09-07): private,
verifiable polling now; demographic results next; reduction of single-operator trust
and failure thereafter. Sections below contain design options across those stages,
not a requirement to implement every store or worker for Stage 1. The PostgreSQL design
is a hybrid candidate, not an accepted centralized source of identity/result truth.
Distributed private storage/computation remains an evaluation option for Stage 3;
no Nillion/TACEO or other infrastructure choice has been made.

## 1. Proposed architecture and why

One hybrid candidate uses PostgreSQL for application state and minimized verification evidence, private
encrypted object storage for coordinator artifacts, and the existing contracts for
encrypted messages and verified overall results. Use a separate, narrowly authorized
worker for demographic aggregation. Public APIs read only approved report snapshots.

These are separate access boundaries, not necessarily separate database servers.
Schema names alone do not enforce separation: provision distinct database roles,
explicit grants and encryption keys. The public API role must have no access to
identity evidence or analytics inputs. Infrastructure administrators can still bridge
these boundaries; this design does not promise privacy from a colluding operator.

The product can deliver real demographic reports without first inventing a new MACI
circuit: an authenticated, operator-computed report is a feasible first architecture.
Its correctness and confidentiality must be described separately from the verified
overall tally. A proof-backed demographic computation is a defined extension, not a
reason to substitute fake charts or permanently exclude demographics.

## 2. Where each piece of user data lives

| Store / role | Records and essential fields | Must not contain |
| --- | --- | --- |
| Participant device / wallet | Wallet session; independent MACI key scoped by account and deployment; transaction/vendor handles for recovery | Server issuer or coordinator secrets |
| Application database / account service | Internal random account ID; login-provider subject; participating account address, chain and wallet kind; optional ENS reference | Ballot choice, raw passport or demographic profile |
| Verification database / eligibility service | Provider/version/environment; approved policy; opaque session correlation; status; verified-at/valid-until; encrypted provider identity signal; versioned keyed duplicate tag; account ownership evidence reference | Document image, full DOB by default, passwords, raw webhook/HTTP payload archive |
| Authorization ledger / eligibility service | Account, chain, target, action, nonce, config, expiry; issuance status; confirmed consumption reference | Choice or plaintext demographic fields in signed public evidence |
| Poll attribute snapshot / analytics intake | Poll context, account binding reference, consent/policy version, coarse age band, official sex/gender, verified geography when available, source and reference date; encrypted at application layer | General-purpose lifetime political profile or self-reported replacements |
| Binding ledger / analytics intake | Verified credential ID → poll state index; join transaction/log position/block hash; verification method; supersession/reorg state | Ballot choice |
| Private object store / coordinator | Encrypted replay checkpoints, decrypted final ballot state, proving witnesses and private processing artifacts; short-lived worker access | Publicly accessible state files, plaintext keys in command logs |
| Chain | Signup/join state, public execution metadata, encrypted vote messages, proof commitments, verified published overall option totals | Demographic attributes, raw provider identity, individual attribute-choice rows |
| Report store / release service | Immutable released aggregates; provenance; verification kind; suppression/coverage; release version; block hash | Row-level inputs or hidden-cell exact counts in API payloads |
| Public Graph / read API | Public poll descriptors, chain progress, overall outcomes and approved public report data | Private credentials or an API to join wallets to demographics |

The same person can have many transactions. The application account is not a proof of
unique personhood. Preserve the selected provider's scope and document limitations;
do not equate different providers' identity tags.

### Concrete database identities and constraints

- `accounts`: unique `(auth_provider, auth_subject)`; account linking is authenticated,
  not inferred by matching email strings. Wallet bindings record actual caller identity.
- `verification_sessions`: unique `(provider, environment, provider_session_id)`;
  server-generated request ID; terminal outcome immutable except explicit revocation.
- `webhook_inbox`: unique provider delivery ID, authenticated receipt time, processing
  status and minimized normalized outcome. Authenticate raw bytes before normalization;
  process inbox and session changes in one transaction. Never retain raw payloads merely
  to implement retries. Conflicting duplicate outcomes trigger investigation.
- `verified_subjects`: unique `(provider, environment, uniqueness_scope, keyed_tag)`;
  provider-specific encrypted identity signal retained only if needed to mint fresh
  poll-scoped grants. Key versioning/migration must preserve duplicate detection.
- `authorizations`: unique `(domain, target, action, nonce)`; transactionally reserve
  issuance. Lost responses return the same grant; ambiguous broadcast reconciles before
  reissue. On-chain consumption is authoritative; database state cannot undo it.
- `poll_attributes`: unique `(poll_context, verified_subject, analytics_policy_version)`;
  freeze the contribution and reference date at the poll's declared cutoff. Account
  recovery must not create a second subject. Updates before cutoff are versioned.
- `ballot_bindings`: unique `(poll_context, poll_state_index)` and one active binding
  per `(poll_context, verified_subject)`; retain fork/block provenance and orphan status.
- `tally_runs`: unique `(poll_context, canonical_input_digest, circuit_version)`;
  processing/checkpoint/proof-submission/publication states and retry leases.
- `report_releases`: unique `(poll_context, tally_commitment, analytics_policy,
  release_version)`; publish an immutable snapshot transactionally after approval.

`poll_context` is chain ID + MACI address + poll ID + resolved Poll address, bound to
the immutable descriptor. Never use a URL slug, ENS label or browser-selected poll ID
alone as a foreign key. Use integer/decimal representations for field elements and
counts; do not round them through JavaScript floating-point numbers.

### Retention and recovery

Use explicit `expires_at` / `delete_after` fields and scheduled deletion jobs, including
backup expiry. Separate challenge expiry from eligibility validity and analytics
retention. Product defaults need a concrete deployment policy; no permanent retention
is implied by these tables. After the agreed report challenge period, delete private
demographic snapshots and joined worker artifacts unless another justified retention
purpose applies. Retained commitments and their privacy properties need review too.

The ordinary backend never needs a MACI private key. Wallet login recovery does not
restore that key. Device-only storage is the current limitation, not a complete account
recovery design. An encrypted backup may be stored as an opaque blob only after choosing
client-side encryption/recovery custody; a server-controlled key would give the server
access and must not be described as user-only recovery.

## 3. The actual vote processing path

1. Verify account control and eligibility. The provider adapter returns normalized
   evidence for the approved policy; our issuer currently signs a scoped authorization.
   The Enterprise candidate accepts age-only results today and explicitly rejects extra
   attributes. Nationality/age-band/sex require a reviewed adapter extension, not removal
   of that validation. Source: `EnterpriseEligibility.receiveWebhook` in
   [enterprise.ts](../apps/backend/src/eligibility/enterprise.ts).
2. Register/join with authorization for the actual caller. `Poll.joinPoll` checks the
   joining proof, invokes the policy, obtains voice credits and emits the original key
   and poll state index. [Poll.sol:361](../packages/contracts/contracts/Poll.sol#L361).
3. The client signs a MACI command and encrypts it to the coordinator. Publish to the
   Poll; record execution identifiers, not selected answers in application telemetry.
   [generateVote](../packages/sdk/ts/vote/generate.ts),
   [submitVote](../packages/sdk/ts/vote/submit.ts).
4. After closing and canonical input collection, the coordinator runs the existing
   message processor. It checks signature, nonce, option and credit rules and produces
   final ballot state; invalid messages do not become extra votes. Do not reconstruct
   the answer with a SQL "latest transaction wins" query.
   [Poll.processMessage](../packages/core/ts/Poll.ts#L303).
5. Generate and submit processing/tally proofs through the existing proving tools.
   Replay checkpoints and witnesses are private: `Poll.toJSON` includes ballot state.
   The existing `prove` task accepts the coordinator key as an argument; production
   runner work must replace secret-bearing CLI invocation with private secret loading.
   [prove task](../packages/contracts/tasks/runner/prove.ts),
   [submit-on-chain task](../packages/contracts/tasks/runner/submitOnChain.ts).
6. Publish all configured option totals through `Tally.addTallyResults`. It verifies
   membership against the tally commitment and records `value` and `isSet`. A completed
   tally proof is not necessarily completed result publication.
   [Tally.sol:344](../packages/contracts/contracts/Tally.sol#L344).
7. Read a consistent canonical block snapshot: resolve MACI → Poll/processor/Tally;
   validate deployment, mode and descriptor; require processing complete, tally complete,
   appropriate commitment and every configured option's `isSet`. Preserve block hash and
   confirmation policy. A zero result with `isSet=true` is different from unset zero.
8. Publish overall results independently of demographic availability. The UI can show
   verified overall results while a demographic report is still processing or withheld.

### Existing result path removes a false dependency

[SDK results.ts](../packages/sdk/ts/tally/results.ts) already exposes `getResults`,
`getResultPerOption` and `isTallied`. The current helper does not itself supply all the
consistent-block/completeness/finality checks above. Extend/wrap that path for the UI.
Missing tally events block the current event-indexed Graph path, not direct contract
reads. The first result API can use RPC; add an explicit publication signal plus
verified reads to Graph later. G06 is not closed until publication and display work.

### Candidate-preference semantics

The repository already has FULL mode in both core and circuits. Core processing clears
other option weights for a valid FULL command. Review FULL with exactly one initial
voice credit as the first candidate for one-person/one-choice polls. Prove parity of
core, circuit, deployment and UI before selecting it. NON_QV with one credit is another
bounded option, but update commands differ. Do not silently inherit QV or large credit
balances and call weighted totals numbers of people.

Evidence: [core FULL branch](../packages/core/ts/Poll.ts#L373),
[full circuit](../packages/circuits/circom/utils/full/MessageValidator.circom),
[core tests](../packages/core/ts/__tests__/e2e.test.ts). These were source-reviewed,
not rerun in this architecture pass. Include abstain/undecided as explicit options if
chosen; a zero ballot means no counted selection, not an inferred abstention option.

## 4. How verified demographics attach to counted votes

Use `(poll_context, poll_state_index)` as the internal join, after independently
verifying the original join. The index persists while the state's voting public key can
change. Joining by the final public key, latest wallet, ENS name or message count is wrong.

The current policy ABI receives `(account, evidence)`, not the join public key. Adding
a public-key hash to the credential does not enforce that the join used it. The
operator-computed path must establish the relation through actual execution evidence:

1. The attribute service authenticates the subject and ownership of the participating
   account and freezes the official-source attributes under the poll policy.
2. A reconciliation worker verifies canonical successful join execution, consumed
   authorization for that account, and the matching PollJoined log/index. For direct
   EOAs, validate sender/recipient/calldata and event. For bundled smart-account execution,
   require a supported execution decoder/trace or reviewed wrapper binding. Merely
   finding two logs in the same transaction is insufficient when a bundle joins many
   accounts. Unsupported attribution stays unbound.
3. Persist the unique binding with block/log provenance. Credentials arriving without
   an authenticated join are not counted. Reorgs invalidate affected bindings.
4. Freeze an input manifest at the declared cutoff. Verify credentials, consent,
   policy/reference date, allowed categories and binding uniqueness. A valid ballot
   without optional evidence goes into missing coverage; conflicting or duplicate
   binding is an integrity failure, not a reason to silently drop a row.
5. Inside the restricted worker, read final processed ballot vectors by index, skipping
   the blank leaf. For the approved single-choice/one-credit configuration assert every
   nonzero ballot has exactly one unit at one valid option. Abort on incompatible
   vectors rather than coerce weighted votes into people.
6. Accumulate overall and per-dimension totals, missingness and denominators. Compare
   reconstructed overall vector with the verified published tally before release.
   This detects inconsistency but does NOT cryptographically prove the attribute join
   or the final individual ballot assignment: an operator could reshuffle assignments
   while preserving totals. Label this report `operator_computed`.
7. Release only the approved aggregate snapshot. Delete ephemeral joined rows; restrict
   core dumps, traces, backups and debugging exports because they can retain plaintext.

For each dimension, all category totals plus missing must equal the overall vector
internally. Public suppression may hide those components; never ship them in hidden
JSON fields. Counts refer to final counted ballots, not joins or encrypted messages.

## 5. Three concrete privacy/correctness choices

| Design | Who can see individual attribute/choice linkage? | Correctness evidence | Consequence |
| --- | --- | --- | --- |
| A. Restricted aggregation worker | Worker/operator; collusion with coordinator/identity service can recover more | Authenticated inputs, deterministic replay, reconciliation; operator-computed demographics | Feasible first real demographic implementation without new voting circuits |
| B. Additional demographic proof | Prover can still see witnesses unless further protected | Proof checks credential validity/binding and final ballot commitments | Stronger report integrity, not automatically privacy from operator |
| C. Distributed/private computation | Depends on selected non-collusion/secure-computation model | Protocol-specific proof and custody assumptions | Requires a different deployment/security design; not achieved by encrypting a database |

Recommendation for a concrete first build: implement A with strict access/retention,
honest disclosure and a release gate, while designing its manifests for B. This is a
proposal requiring Alejandro's decision before real attribute-choice collection. It
does not claim "nobody can see how you voted." If operator privacy is required now,
choose C explicitly and assess that implementation instead of pretending A meets it.

For B, the proof must bind the accepted eligibility/attribute input commitment and
the same final state/ballot commitment used by MACI; cover all active indices, canonical
missing entries, policy, one-person contribution and report totals. An issuer-signed
credential still trusts that issuer for attributes. A root we publish ourselves does
not prove completeness or truthful enrollment. Freeze and authenticate the input set
before outcome-dependent selection can bias it. Public outputs must respect the release
policy: proving exact suppressed cells publicly defeats suppression.

## 6. Result publication and product API

- `GET /polls/:context`: immutable question/options, schedule, eligibility and analytics
  policies plus current availability. No demographic user profiles.
- Authenticated `GET /me/activity`: verified participation/submission references and
  public poll/result links. Never expose a per-person "counted choice" receipt.
- `GET /polls/:context/results`: block/hash, tally commitment, mode, ordered option
  totals and finality. Processing, partial publication and RPC failure are distinct.
- `GET /polls/:context/reports/:release`: immutable released aggregates, source labels,
  coverage, denominator, suppression and verification kind. No arbitrary row-level query.

Post-close report snapshots are the first release mechanism, with predefined dimensions.
Small-cell/complementary/homogeneity and cross-table reconstruction checks are required;
there is no universally safe cohort-size constant. More flexible queries can use a
reviewed differential privacy budget later. Public, paid and agent access share the
same release ledger; payment must not buy access to hidden individual records.

## 7. Work that follows directly from these findings

1. Mount durable session/inbox/authorization handling and the selected identity adapter.
   Keep provider trial findings separate from production policy decisions.
2. Build the canonical result snapshot reader and wire a real poll descriptor into
   submission/results. Existing Tally storage is the first source; Graph follows it.
3. Test FULL/one-credit processing, real proving artifacts and submitted proof parity.
4. Build authenticated join binding, first for supported execution, then smart accounts.
5. Implement the aggregation worker with synthetic final-state/attribute fixtures,
   including vote/key updates, duplicate bindings, missingness and tally mismatch.
6. In Stage 2, review a concrete release policy and operator-access model, then enable a
   consenting real cohort. Steps 4–6 are later demographic work, not Stage 1 prerequisites.

No application runtime changed in this pass. These are source-grounded architecture
decisions/proposals with implementation gates, not executed provider trials or a deployed
storage system. External docs/pricing are intentionally left to Hermes's bounded trial.
