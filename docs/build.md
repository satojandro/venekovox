# Integration specifications and runbook

**Design contract, not an implementation claim.** Baseline and gaps:
[status.md](status.md). Product decisions: [roadmap.md](roadmap.md). Call-by-call
truth: [journey-map.md](journey-map.md). The following interfaces describe required
behavior; names are illustrative unless explicitly tied to source.

---

## Part A — Integration specifications

**Active scope, approved 2026-09-07:** Stage 1 private, verifiable polling under the
[three-stage roadmap](roadmap.md#three-delivery-stages--accepted-2026-09-07). Complete
one identity/account/authorization/submission/recovery/verified-results path. The provider
comparison informs that choice; both providers need not ship. Demographic implementation
is Stage 2; reducing single-operator trust/failure is Stage 3. Later architecture and
VicRoads/distributed-infrastructure research below are preserved, not current release gates.

### Data storage and result processing — architecture review 2026-09-07

Read [data and tally architecture](data-and-tally-architecture.md) for proposed database
records/access roles, authenticated join-to-ballot binding, existing direct Tally result
reads, voting mode findings and the operator-computed versus proof-backed demographic
paths. This defines implementation boundaries; no database or private analytics service
has been deployed. Demographic scope remains in Stage 2 of the accepted delivery sequence.

### S2.1 provider comparison trial — approved scope, 2026-09-07

Alejandro approved a bounded Self Enterprise versus ZKPassport trial and proposed
myVicRoads as an Australian licence eligibility source through zkTLS. This approves
evaluation, not a provider migration or accepting multiple independent identity
methods in one poll. D02 remains the implementation baseline pending trial results.

**Deliverable:** a reproducible comparison with pinned versions, public configuration,
synthetic negative tests, privately operated real-document sessions and a recommendation.
Keep provider experiments outside the active login/voting route. Dependencies: S2.2
actual caller/account model, D12 uniqueness and recovery policy. No new cryptographic
primitives or circuit forks are needed for the initial comparison.

| Test | Evidence required for both providers |
| --- | --- |
| First visit | Actual target document/device, elapsed time, prompts, completion/failure; no identity payload in evidence |
| Return visit | Repeat proof from registered document versus fresh scan; refresh and new-device recovery measured separately |
| Verification boundary | Local cryptographic verification, hosted API, webhook and contract roles identified; test remote fallback explicitly |
| Authorization | Bind approved policy, account, chain, target, action, expiry and nonce; wrong-account, wrong-poll, replay and expired evidence rejected |
| Uniqueness | Repeat same document across accounts; determine renewal, second-document and changed-scope behavior; unknown cases stay unknown |
| Privacy | Enumerate recipients of attributes, proofs and metadata, retained state and public identifiers; no raw documents or low-entropy ID hashes on chain |
| Operations/cost | Confirm pricing, limits and licence terms; measure per-success cost including retries, infrastructure, gas, support and maintenance at 1k/10k/100k verifications |
| Recovery | Lost wallet, lost device and independent MACI-key recovery; no silent second membership |

Run source/API review first, then synthetic integration tests, then Alejandro-operated
real sessions, then a recommendation. Stop expanding after one complete representative
path per provider; unsupported documents and untested cases are explicit limitations.
Do not label an SDK callback or fixture result as a verified document. No price advantage
is established yet. AI-assisted implementation reduces some engineering effort; it does
not replace security review, supported certificate coverage or ongoing operations.

ZKPassport's current [SDK README](https://github.com/zkpassport/zkpassport-packages/tree/main/packages/zkpassport-sdk)
documents local verification with API fallback, selectable verifier mode, and identifiers
stable for the same ID/domain/scope. It also states that external auditing is outstanding.
Pin and recheck these properties in the trial. Removing our eligibility issuer requires
an actual contract-verification design; swapping backend SDKs alone does not remove it.

#### VicRoads zkTLS feasibility slice

Proposed user outcome: prove a current Victorian driver-licence record without sending
VenekoVox the licence number, name, date of birth, address, password or session cookies.
This is not implemented. An illustrative verified output is `issuer=VicRoads`,
`credential=driver-licence`, `jurisdiction=AU-VIC`, `status=current`, proof freshness and
account/action binding. These are our desired semantics, not observed API field names.

[VicRoads account help](https://www.vicroads.vic.gov.au/help-centre/myvicroads-personal/account-help)
confirms licence services but explicitly permits account creation without licence or
registration documents. Login success and customer number alone are insufficient.
Issuing jurisdiction is not proof of current residence, citizenship or electoral
eligibility. A recorded address requires a separate source/freshness policy.

1. Identify a read-only, authenticated licence response in an owner-operated session;
   verify the authoritative hostname, record type, status/expiry and holder relationship.
   Do not infer endpoints or inspect/export credentials. Alejandro handles login/MFA
   privately; do not upload HAR files, raw responses or document screenshots.
2. Check TLS compatibility, browser/mobile support, redirects and practical proof time.
   TLSNotary currently documents TLS 1.2; actual endpoint compatibility remains unknown.
3. Build parser/predicate tests against synthetic responses: no licence, learner/marine
   record, expired/suspended record, absent status, wrong host, stale proof, edited data,
   account switch and replay. Missing authoritative evidence fails closed.
4. Prove the predicate from authenticated response data. Browser-derived booleans are
   not evidence. Redaction must also cover cookies and unrelated response fields;
   distinguish selective disclosure from computing hidden predicates with ZK.
5. Specify a stable source identifier and privacy-preserving scoped duplicate check.
   A plain public hash of a licence/customer number is not an acceptable design.
   Test replacements/account changes before claiming unique licence-holder enforcement.
6. Capture an owner-operated proof with only minimized outcomes/timing recorded. No
   production acceptance until the source, proof, parser and account binding all pass.

[TLSNotary FAQ](https://tlsnotary.org/docs/faq/) explains direct verifier participation,
optional delegated notarization and the off-chain verifier path for on-chain use.
[Quick start](https://tlsnotary.org/docs/quick_start/) includes browser plugins and a
Noir age-predicate example. These support feasibility research, not a working VicRoads
connector claim. Choose and document the trust mode rather than saying zkTLS is trustless.

A VicRoads path may eventually support licence-holder polls without passports, but
must not be accepted alongside document providers as equivalent unique-person evidence
until cross-provider duplicate prevention is solved. Initial source-specific cohorts
must be clearly named. Suitable upstream contributions are a minimized example,
synthetic failure fixtures or a reproduced SDK bug fix; contribution acceptance and
provider replacement are separate outcomes.

### A1. Self → eligibility policy → MACI (S2.1)

Existing entry points: [Self verifier](../apps/backend/src/routes/verify.ts),
[MACI contracts](../packages/contracts/contracts). MACI signup calls
`signUpPolicy.enforce(msg.sender, data)`; poll joining calls its configured policy
with the caller. Current frontend gate data is empty (`0x`). A browser verification
flag is not a credential.

#### Enterprise pivot — authoritative decision, 2026-09-05

Alejandro explicitly authorized the migration. **Self Pass is legacy; new identity
integrations use Self Enterprise.** This supersedes the old D02 and every instruction
to preserve Pass or avoid Enterprise setup. Keep historical Pass source identifiable
until the frontend and backend cut over together. Do not remove dependencies still
used by that route; do not copy its disclosure/logging behavior into Enterprise.
[Official legacy notice](https://docs.self.xyz/docs/self-pass/) ·
[Migration guide](https://docs.self.xyz/docs/self-enterprise/migration/from-self-pass-sdk/)

Enterprise manages verification; our backend authenticates its result and issues a
separate, short-lived MACI authorization. This adds trust in Self's delivery service
and our authorization issuer. It is not direct verification of the Self proof by the
Sepolia MACI contract. A supported provider is not an approval of every flow default.

#### Required handshake

1. Establish the actual participating account and configured chain. With a smart wallet, use the smart account address, not its owner/embedded signer address.
2. Create a short-lived verification challenge bound to the intended action and domain. Prove control of the participating account with a method that supports its account type; do not assume EOA-only signature recovery works for smart accounts.
3. Create a Self Enterprise session server-side only after validating wallet control. Bind its opaque reference and returned ID to the challenge and pin the approved flow version and environment.
4. Verify raw webhook bytes using the official Enterprise SDK. Validate the recorded session, flow version, environment, eligibility status and rules. Recover the account from the server record; never from a redirect or client claims.
5. Produce or validate policy authorization scoped to chain, policy/contract, account, action and expiry. Include poll scope when required, a replay identifier, and MACI-key binding if chosen by the policy design.
6. Enforce eligibility and uniqueness in the contract path. Consume authorization atomically with successful registration/join. Reject replay, expiry, wrong account/domain/poll, invalid proof and direct bypass.
7. Expose eligibility state to the UI without publishing raw document attributes or stable identity linkage unnecessarily.

#### Decisions before deploying

| Decision                 | Constraint                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification bridge      | Direct proof/credential verification versus backend-issued authorization; document issuer trust, revocation and supported chain compatibility             |
| Unique participant scope | Define per-MACI registration and per-poll participation behavior; Self nullifier semantics must be verified, not inferred from MACI membership nullifiers |
| Account changes          | A second wallet must not become a second eligible human. Define migration/recovery without reopening duplicate membership                                 |
| Eligibility              | Minimum age, document support and any location restrictions are product policy, not incidental SDK defaults                                               |
| Ballot semantics         | Select voting mode, voice credits, choices and update rules explicitly; current default weight/nonce does not prove one-person-one-choice tally semantics |
| Data handling            | Remove unnecessary nationality/gender disclosure and full response/log payloads, or explicitly justify them; define retention and access                  |

Negative acceptance cases: bypass Self UI; reuse authorization from another account or
poll; change chain; use expired/replayed authorization; use two wallets for the same
scoped identity; interrupt after registration before join; recover and retry.
Demonstrate both eligible and ineligible paths against the actual deployed policy.

Demographic analytics attributes (see
[demographic-analytics-spec](demographic-analytics-spec.md)) are a separate, consented,
versioned collection policy. They do not undo the eligibility-path minimization (G09):
the eligibility verifier still minimizes nationality/gender disclosure and logging, and
analytics collection never re-introduces raw disclosure payloads into eligibility
responses or logs.

#### Implemented P2 candidate — isolated, unmounted, undeployed

Source in this patch:

| Component                                                            | Responsibility                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/eligibility/enterprise.ts`                         | Wallet-authenticated session creation, server-owned correlation, strict completion checks and minimized claims |
| `apps/backend/src/eligibility/enterpriseSdk.mts`                     | Native ESM adapter to pinned `@selfxyz/enterprise-sdk@0.4.1`; official webhook verification                    |
| `apps/backend/src/eligibility/authorization.ts`                      | Five-minute challenges, scoped HMAC tags, EIP-712 grants, issuance lock and idempotent recovery                |
| `apps/backend/src/eligibility/accountControl.ts`                     | Account-control signatures: EOA/7702 recovery or deployed ERC-1271 on the configured chain                     |
| `packages/contracts/contracts/eligibility/SelfEligibilityPolicy.sol` | Target-only, issuer-authenticated, single-use policy enforcement                                               |

```sh
  Participating wallet          Eligibility backend              Self Enterprise          MACI / Poll
        |                              |                              |                      |
        | Sign challenge               |                              |                      |
        |  (account + target domain)   |                              |                      |
        |----------------------------->|                              |                      |
        |                              | createSession(opaque ref)    |                      |
        |                              |  [account-control checked    |                      |
        |                              |   BEFORE this API request]   |                      |
        |                              |----------------------------->|                      |
        |      hosted verification journey (wallet visits Self)       |                      |
        |<------------------------------------------------------------|                      |
        |                              |      signed completion webhook                      |
        |                              |<---------------------------------------------|      |
        |                              | match session / environment /                       |
        |                              | version / rules; minimize claims                    |
        | Request authorization        |                              |                      |
        |  (repeat wallet signature)   |                              |                      |
        |----------------------------->|                              |                      |
        |        short-lived signed policy evidence (EIP-712)         |                      |
        |<-----------------------------|                              |                      |
        | signup / join with evidence  |                              |                      |
        |------------------------------------------------------------|--------------------->|
        |                              |          enforce policy, then complete              |
        |                              |          operation atomically                       |
```

**This diagram maps candidate modules, not a working HTTP or browser journey.**
No route or frontend wallet code is changed to call them. The current browser still
passes empty policy data. A separate policy instance/grant is required for MACI
signup and each Poll join; putting signup evidence into the join slot must fail.
The SDK `sgData` and `sgDataArg` slots need integration after W1's caller is captured.

The server stores the challenge-to-session relationship. Only the opaque challenge
reference goes to Self; wallet address and signing message are not sent as metadata.
A hosted redirect cannot mark eligibility. Completion must match both session ID and
reference, configured flow and frozen version, and test/live environment. The candidate
checks a backend-mode Age Verification result against the explicit age floor, rejects
OFAC-on and unexpected reveal/rule keys, and keeps only bound account, internal context
and normalized identity signal. The raw proof is discarded, never logged or returned.
The public hook must preserve raw bytes; reconstructing JSON breaks signature checking.
Implementation details were checked against the installed 0.4.1 JavaScript and types.
[SDK documentation](https://docs.self.xyz/docs/self-enterprise/sdk/nodejs/) ·
[Webhook verification](https://docs.self.xyz/docs/self-enterprise/sdk/verify-webhooks/)

**Candidate policy choice:** age 18+, no OFAC, no demographic reveals, backend mode.
It is configurable and not a silently accepted platform-wide eligibility rule. The
Age Verification workspace can enforce an age threshold without disclosing birth date;
its defaults must be changed deliberately to match our manifest.
[Age Verification](https://docs.self.xyz/docs/self-enterprise/workspaces/age-verification/)

#### Identity, privacy and trust boundaries

Enterprise documents an organization-scoped uniqueness signal. Confirm repeated
verification, multiple wallets, supported documents, renewals and cross-flow stability
in staging before promising one-human-one-vote. A document-backed identifier does not
by itself prove representative sampling or solve account recovery.
[Verification model](https://docs.self.xyz/docs/self-enterprise/get-started/how-it-works/)

Our tag is HMAC-SHA256 over a stable operator identity namespace, test/live environment,
chain, policy address, target, config, action and canonical numeric nullifier. It excludes
wallet and challenge so the same identity under two wallets hits the same contract
one-use slot. A second identity under the same wallet is also rejected. The adapter
accepts bounded decimal or hexadecimal integer nullifiers and fails closed on any
other format; verify real SDK/service output before mounting. Do not invent a random
replacement identifier, use session IDs for uniqueness, or equate Self's nullifier with
MACI's join nullifier.

Keep the namespace and HMAC secret stable. Changing either, redeploying the policy or
switching Self organizations can reset effective uniqueness; these require migration
analysis. Cross-policy tags differ, but the wallet and authorization calldata remain
public. This does not make participation unlinkable. Self and the issuer can observe
verification-to-wallet correlation through their respective roles; standard MACI
coordinator privacy limitations still apply. No demographic information is added to ENS,
the Graph or this evidence. Premium demographic analytics remains separate scope.

The issuer is trusted to issue honestly and protect its signing key. The contract pins
one EOA issuer; user wallets may be contract accounts. It has no issuer rotation,
revocation, account migration or recovery mechanism. Those are explicit rollout gates.
No exact MACI public-key binding is claimed: the existing `enforce(address,bytes)` ABI
receives the caller and evidence, not the signup/join public-key argument. Adding a hash
to evidence alone would not enforce equality with that argument.

#### Authorization specification and deployment preparation

EIP-712 domain: name `VenekoVox Self Eligibility`, version `1`, configured chain ID,
and policy address as `verifyingContract`. The signed `Authorization` fields are
`account`, `target`, `identityTag`, `configId`, `action`, `nonce`, `issuedAt`, `expiresAt`.
The last two are uint64; hashes are bytes32. See `AUTHORIZATION_TYPES` for canonical order.
`configId` must identify an approved immutable manifest including organization namespace,
environment, flow/version, eligibility predicates, issuer and recovery policy. Keep that
manifest with the release evidence; do not reuse its ID after changing rules.

Deploy a distinct policy for each signup/join target with owner, issuer, config and action;
then configure MACI/Poll to use it and bind its target once via owner-only `setTarget`.
Binding requires deployed target code. Read all configured values back before enabling
issuance. The policy rejects direct calls, empty/forged/expired evidence, wrong domain,
account/target/action/config and duplicate identity/account. Consumption rolls back if
signup/join later reverts. No funded deployment or operator credential setup was performed.

Before mounting the candidate:

1. Approve issuer trust, age/document/security-level choices, uniqueness and recovery.
2. Alejandro provisions Enterprise test flow/version and API/webhook secrets privately.
   Pin the reviewed version: a new dashboard deployment must fail closed until reviewed.
3. Replace in-memory maps with durable transactional challenge/session/result and issuance
   storage. Persist minimized acceptance and deduplication before acknowledging a webhook.
   Duplicate deliveries must be idempotent; contradictory completions need investigation.
   A completion arriving before session persistence should be retried, never accepted blindly.
4. Mount rate-limited, size-limited endpoints with origin/authentication controls. Verify
   raw-body signatures using the endpoint-specific secret. Recognized failed eligibility
   should become an honest terminal UI state, not endless delivery retries. Do not expose
   raw SDK exceptions, payloads, verification URLs or credentials in logs.
5. Load the SDK as native ESM. Existing backend CommonJS is intentionally unchanged;
   `tsconfig.p2.json` checks this separate boundary. Node 22 is the deployment target because
   resolved SDK core/common dependencies declare `>=22 <23`, despite the top-level SDK's
   broader Node 20+ claim. **Resolved 2026-09-06:** root `engines.node` is now `>=22 <23`
   (was `20`, a documented deviation from upstream MACI's node-20 pin); full suite
   re-verified on Node 22.20.0 — see [status.md](status.md) "Runtime decision". Remaining
   gate: W1 has not yet been re-run on Node 22 since the pin change.
6. Integrate authenticated status/recovery and the two evidence slots with W1. Counterfactual
   ERC-6492 signatures are unsupported; deploy the account first or add a reviewed adapter.
7. Run mock and real-document journeys, two-wallet duplicate attempts, wallet switches,
   restart/retry, signup/join rollback and a real votable-poll submit/refresh flow. Only then
   retire the legacy route/QR and remove their now-unused dependencies.

#### Local verification and W1 handoff

**Dependency gate:** this patch declares SDK 0.4.1, but its pnpm lock update is incomplete because network approval was cancelled during regeneration. Regenerate/review the lock with repository-approved pnpm 9/10 before using the following commands in a frozen workspace. This is not a merge-ready dependency change.

Backend tests use the actual Enterprise SDK for signature/schema validation with synthetic
Svix-signed deliveries; session creation is a test double. They do not contact Self.
Local EVM tests compile Solidity with 0.8.28 and use a target harness matching the policy
call boundary, including a real deployed ERC-1271 fixture and rollback. They do not run
full MACI circuits, Privy sponsorship or a real Self proof. No frontend/workspace build
success or live acceptance is implied by these tests.

```sh
pnpm --dir apps/backend test:p2
pnpm --dir apps/backend typecheck:p2
```

The optional local EVM suite needs `solc@0.8.28`, `ganache@7.9.2`, `ethers@6.15.0`,
`@openzeppelin/contracts@5.4.0`, `@excubiae/contracts@0.11.0` and TypeScript. Install them
in a separate scratch package, together with `@selfxyz/enterprise-sdk@0.4.1`, and set
`P2_TOOLCHAIN_PACKAGE_JSON` to that package's absolute package.json path for the test
loader. This does not add Ganache to production dependencies.

```sh
node --test packages/contracts/test-p2/eligibility.evm.test.mjs
```

W1 runtime files are untouched. The shared backend `package.json` must retain both W1
scripts/dependencies and P2 additions; regenerate/review the lock after combining them.
Consolidated docs require semantic reconciliation: retain Enterprise D02 and translate
W1 updates into existing docs, never restore the superseded Pass-only decision or deleted
documentation set. Caller identity must be captured from W1's actual participating account,
not its owner, bundler or receipt outer sender.

### A2. Wallet and sponsorship adapter (S2.2)

Current [useMaci](../apps/front-end/src/hooks/useMaci.ts) depends on `window.ethereum`
and an ethers signer. Preserve the proven flow's context checks while replacing this
coupling.

An adapter must expose: readiness/authentication, noninteractive account/chain
inspection, explicit connect, account-change subscription, a compatible contract
execution path, and transaction confirmation. Capture
`{chainId, maciAddress, pollId, account}` once per operation; validate context before
each new submission and every UI write. Switching accounts cannot cancel an
already-broadcast transaction; retain its original context.

Prototype SDK compatibility before a provider-wide rewrite. Signup, join and publish
currently expect ethers-style execution; either supply a tested signer bridge or
separate call preparation from sending. Prove that policy `msg.sender` is the intended
smart account. Check contract/account signature validation independently from basic
transaction execution.

Privy is a candidate. Its documented high-level smart-wallet `sendTransaction` returns
a transaction hash; lower-level user-operation APIs have different receipt handling. Do
not label a user-operation hash as a mined transaction. Confirm the exact installed API
and peer dependency versions using
[setup](https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/setup/configuring-sdk)
and [usage](https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/usage).

Sponsorship must cover the complete supported journey, including any account
deployment, signup, join and publish. Limit chain, target contracts, permitted methods,
spend and request rate. Keep sponsor credentials server-side. Define
denied/exhausted/unavailable sponsorship behavior; do not silently switch to an
unexpected paid transaction.

Acceptance: a new participant with zero ETH completes the chosen journey, refreshes
and recovers correct state; injected fallback still works; rejected sponsorship,
session expiry and account/network changes are recoverable. Record actual caller, tx
hashes and gas payment evidence. Vendor configuration alone is not completion.

#### MACI key lifecycle

Wallet keys, MACI signing keys and encryption randomness have separate purposes. Never
derive or log secret voting material casually. Current global browser storage is a
known gap (G04), not a recovery strategy. Decide scope and migration of existing keys
before changing storage: discarding a registered key can strand membership. Hydration
should read an existing key and show a missing/recovery state rather than generate a
replacement silently. Specify multi-device, logout, account switching and lost-browser
behavior before promising recovery.

### A3. ENS profile → application (S1.1)

ENS supports navigation and a persistent public pseudonym. Resolve it from the actual
participating account using the selected ENSv2 Sepolia deployment. Support missing
name, failed resolver, reverse/forward mismatch and name collision; retain an address
fallback.

Desired subnames are persistent, nontransferable and without expiry. Verify those
properties against the chosen registry/registrar implementation and define profile
recovery; they are requirements, not existing contract guarantees. A successful name
resolution must never skip Self verification or grant MACI membership.

Do not publish Self nullifiers, private voting keys, document attributes or ballot
choices in ENS records. Explain that associating a name with a participating address
can expose public transaction history and recurring participation metadata.

Acceptance: a real registered/resolved name changes the live user experience; another
user's name cannot authorize participation; unresolved names degrade gracefully;
transaction and registry/resolver evidence is recorded.

#### Planned ENS interaction contract (S1.1)

Product overview: [target journey](journey.md#target-journey--proposed).
This contract is proposed; no ENS calls are added by the documentation patch.

1. Capture the actual participating account and chain from the selected wallet
   adapter. Record the ENS registry/resolver network separately if different.
2. Resolve an existing name, verify applicable forward/reverse agreement, and
   discard stale responses after an account change. An address is always usable.
3. Offer optional creation of a persistent public pseudonym with a clear linkage
   notice. Confirm supported registry, ownership, collisions, fees/sponsorship,
   transfer/expiry and recovery semantics before implementing registration.
4. After a mined registration/update, re-read resolution before displaying success.
   A pending name transaction is not a confirmed profile. Retry must not duplicate
   registration or consume payment twice.
5. Keep eligibility authorization entirely separate: never write document data,
   Self nullifiers, MACI private keys or choices to ENS; never use a resolved name
   as proof of unique humanity or permission to join.

Test missing name, resolver failure, mismatch, duplicate name, rejected registration,
account switch during lookup and profile recovery. Name-service failure must leave
an already-authorized participant able to vote. Contract-level nontransferability
and no-expiry requirements remain open feasibility/recovery decisions (D04).

#### Implemented first slice: named poll discovery (2026-09-06)

S1.1 begins with **poll names**, not personal pseudonyms. The app now links the poll
explorer to `/discover`; `/p/:name` resolves and displays a named poll's checked
on-chain reference and schedule. This is read-only and requires no connected wallet.
The old `/polls/:id` page still contains fixed mock question/results metadata; do not
route ENS names into it or imply it renders the resolved target. Wiring the validated
reference into the real voting/metadata flow remains a separate integration step.

Source: [pollName.ts](../apps/front-end/src/ens/pollName.ts),
[NamedPoll.tsx](../apps/front-end/src/pages/NamedPoll.tsx), and `tests/ens/`.
No new dependencies. Uses ethers 6.15.0 normalization, DNS encoding and ABI calls.
The resolver does not use ethers' legacy registry lookup or request wallet signatures.

**ENSv2 network boundary.** Sepolia chain `11155111` uses Universal Resolver
`0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`. The official deployment table says it
routes through ENSv2; it can also mirror unmigrated names, so a successful lookup alone
is not proof that a name was natively registered in v2. Demonstrate a real ENSv2 Beta
name and record-writing transaction for prize evidence. On-chain text records use the
existing `text(bytes32,string)` profile; the Universal Resolver discovers the actual
per-account resolver and handles wildcard/CCIP reads through ethers.
[Deployments](https://docs.ens.domains/learn/deployments/) ·
[App developer guide](https://docs.ens.domains/ensv2/tutorial-app-developers/) ·
[Universal Resolver](https://docs.ens.domains/resolvers/universal/)

**Record contract (application-specific, not an ENS standard).** Set text key
`xyz.venekovox.poll` to a JSON object with exactly these fields:

```json
{
  "version": 1,
  "chainId": "11155111",
  "maci": "0x1111111111111111111111111111111111111111",
  "pollId": "0",
  "poll": "0x2222222222222222222222222222222222222222"
}
```

The addresses above are **synthetic shape examples**, not deployments. Use the real
MACI and the Poll returned by its `getPoll(pollId)`. IDs are canonical decimal strings,
addresses are nonzero Ethereum addresses, and unknown fields/versions are rejected.
The record limit is 2048 characters. `.eth` names only in this first slice.

The reader checks the RPC chain, normalizes the name, reads the record through the
Universal Resolver and validates the MACI against the app's configured deployment
(`VITE_MACI_ADDRESS`). It then requires matching `MACI.getPoll`, deployed Poll code,
and a readable `getStartAndEndDate`. Reads share one block number; the reader checks
its hash again to detect a changed snapshot. A resolved name cannot redirect the app
to an arbitrary URL or unsupported MACI. Window status is a snapshot at the displayed
block, not a transaction preflight; the Poll contract remains authoritative. The end
boundary is inclusive, matching `Poll.sol`'s `timestamp > endDate` rejection.

Name ownership is not poll authorship, personhood, eligibility or official endorsement.
Owners may update records; show the underlying address and re-resolve on revisit.
No wallet/profile association, Self payloads, MACI voting keys, demographic data or
ballot choices are written to ENS. No localStorage cache is used. Stale page requests
are discarded on navigation/retry and provider resources are released on cleanup.

**Operator demo setup:**

1. In the ENS App linked by the official deployment page, select Sepolia ENSv2 Beta
   and register or use a name controlled by Alejandro. Record registration evidence.
2. Configure its text record above using the authorized resolver/ENS App. ENSv2 uses
   per-account resolvers and permissions: do not blindly write to a shared v1 resolver.
   Record the actual setter transaction and name; no registration/write was performed
   by this patch. Alejandro signs privately; no keys are needed by agents.
3. Set client-visible `VITE_ENS_RPC_URL` to a working Sepolia HTTP(S) endpoint and
   `VITE_MACI_ADDRESS` to the real supported deployment. No wallet private keys or
   backend credentials in Vite variables. Endpoint CORS and CCIP gateways must work
   in the browser; unresolved/failed reads show an honest retry state.
4. Start the frontend, open `/discover`, enter the real name, and inspect the checked
   Poll address/window. Share `/p/<normalized-name>` and reopen it in a fresh tab.
5. Demonstrate missing/invalid records and a record pointing at the wrong deployment;
   none may silently navigate to another poll. Capture the name, record transaction,
   contract addresses, lookup block and a functional video. Live/browser evidence is
   still required; this patch includes no claimed registered demo name.

Verify locally with `pnpm --dir apps/front-end test:ens`. The source tests use real
ethers ABI encoding/decoding and deterministic RPC doubles; they do not establish a
live ENS registration, CCIP gateway round trip or browser interaction. Do not count
this discovery slice as completed participant pseudonyms, name registration UI,
name-based voting or ENS prize signoff.

### A4. Poll metadata → contract lifecycle → UI (S3.2)

Proposed descriptor fields: schema version, chain ID, MACI address, poll ID and
resolved poll address, question, immutable ordered option IDs/text, content hash/URI,
creator/provenance, eligibility-policy identifier, voting mode/credits and locale. The
binding between descriptor and on-chain option indexes must be integrity-protected; a
mutable UI array can otherwise change what a vote means.

Read start/end timestamps, membership policy and tally status from the selected
contracts. If metadata and deployment disagree, disable submission and surface the
mismatch. Distinguish scheduled, open, closed, processing, verified and published
states. A loading/failing query is not an empty poll.

M1 may ship a validated static descriptor for one operator-created poll. Later creation
must persist the descriptor and link the deployed poll atomically or with explicit
recoverable intermediate states. Replace mock counts/results; never reuse their numbers
while real data loads.

### A5. MACI → verified tally → The Graph (S4.1 / S5.2)

The coordinator processes messages and produces proofs; contracts verify the tally
commitment. `Tally.sol` exposes tally state and result submission/checking, but
currently has **no dedicated result events** — verified by `grep` in
[journey-map.md §6](journey-map.md). `MergeState` alone cannot trigger a claim that
results are final.

Choose a supported strategy before implementation (decision D13). The Graph
[supports call and block handlers](https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/)
as well as events; call handlers depend on tracing support. Missing dedicated
events do not make indexing impossible. A proof-checked publication wrapper is
also an option to evaluate if preserving upstream contracts is required. A wrapper
must verify source commitments/results, not merely emit operator-supplied totals.

```
  OPTION A  contract extension
            add  event TallyResultsAdded(uint256 pollId, uint256[] results)
            to Tally.sol, emit in addTallyResults()
            pro: clean, canonical, event-driven
            con: modifies an upstream MACI contract

  OPTION B  call/block indexing (Graph callHandlers / blockHandlers)
            poll Tally.getTallyResults() on a schedule
            pro: no contract change
            con: network/trace support or polling latency must be verified
```

Any result event must identify option indices as well as values and bind them to
the verified tally commitment. `addTallyResults` can publish a subset of options;
one event or `isTallied()` alone does not establish publication completeness.

Account for dynamic poll/tally addresses, completeness of all options, result
publication and the limitations of the target Graph network. An unauthenticated JSON
result file is not authoritative simply because its author is the coordinator.

Index provenance: chain/contract/poll, proof/result transactions or equivalent
verified-state evidence, indexed block, tally commitment, finalization state and schema
version. Publish aggregate values only after the selected verification checks pass.
Handle indexer lag/reorgs and missing results without substituting zero.

Acceptance: close a small known poll, process/prove, verify on-chain, publish checked
results, query them through the live endpoint and render the same aggregate values.
Invalid/unverified data must not appear as finalized results. Record the fixture's
methodology and keep private participant secrets out of evidence.

### A6. Native MACI schema → Messari-derived schema (S5.1)

Reference: [Messari OpenZeppelin Governor schema](https://github.com/messari/subgraphs/blob/master/subgraphs/openzeppelin-governor/schema.graphql).
This is a versioned extension design, not "Messari compatibility" established by
copying names.

| Source-model issue                                                              | Required design treatment                                                                                        |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Required token/timelock/delegate concepts do not describe every civic MACI poll | Do not invent addresses, delegates or token-holder counts; define optionality or a separate compatible interface |
| Standard Vote requires choice, voter and weight                                 | Private individual choices cannot be populated from ciphertext; do not publish fabricated zero/abstain votes     |
| Native `Vote` already means encrypted message                                   | Resolve entity naming collision explicitly; preserve message semantics separately                                |
| Binary Governor tally versus arbitrary civic options                            | Preserve ordered option IDs and methodology; only compare compatible quantities                                  |
| Missing individual data versus zero participation                               | Represent unavailable/private data distinctly from measured zero                                                 |

Propose separate fields for ballot visibility, coordinator trust and tally
finalization. A `BallotPrivacy` extension alone cannot express all three. Maintain
public aggregate compatibility where meaningful; document breaking changes, nullable
fields and adapter behavior. Snapshot the exact upstream schema commit used during
implementation.

A shared schema does not automatically create one query across deployed subgraphs.
Choose either a combined indexer for compatible deployments or a client/API composition
layer across endpoints. Record endpoint, network, freshness and methodology per source.
The demonstration must show useful comparative information without implying unlike
voting systems have equivalent populations or weights.

#### S5.1 implementation update — 2026-09-06

The v2 schema, active MACI mappings and comparative reader now exist in
[apps/subgraph](../apps/subgraph/governance-compatibility.md). The pinned Messari
reference is its OpenZeppelin Governor implementation at `2711ac91ef119f321f65b339e10a57f9aa74f9d8`;
there is no root governance schema at that revision. The common proposal query is
validated against both that reference and v2. This is a documented partial projection,
not complete schema compatibility or an accepted upstream contribution.

DeployPoll creates `GovernanceFramework` and `Proposal`; publication, registration and
batch handlers update independent metrics. All native entities are retained. Private
results are null with `UNAVAILABLE` status. Default build schema changes to v2; reindex
from the correct MACI deployment block. The client composes two Graph endpoints; no
federation or live endpoint is configured automatically. See the linked handoff for
exact commands, contribution boundaries and required live evidence.

### A7. Graph → agents → controlled poll creation (S5.3 / S5.4)

Start with read access to finalized public aggregates and poll metadata. The agent
should answer with poll identifiers, source links, sample/methodology limits and
freshness; treat unfinalized data as unfinalized. Never expose private keys, individual
decrypted choices, Self payloads or backend credentials through MCP.

Creation uses the same validated service as human creation: authenticated creator,
question/options/eligibility/schedule validation, quota and idempotency key, then
operator/deployment status. An x402 payment and a chain deployment are not atomic:
define retry, duplicate prevention and paid-but-not-created recovery before charging
real value.

Bazantic qualification requires its actual supported gateway/Recipe workflow, not a
similarly named local README. Compare the same prompt/model/settings/API access with
and without the Recipe and retain evidence. News/resource generation needs source
provenance and a bounded publication/review policy. Agent creation never implies
permission to vote as a verified person.

---

## Part B — Development and demo runbook

These commands are grounded in the reviewed package scripts. They are not a claim that
all services or live integrations were exercised. Run local commands from the
repository root unless a working directory is explicitly shown. Never paste private
keys, identity documents or raw verification payloads into chat.

### B1. Prepare the workspace

Use repository-supported Node 20 and pnpm 9 or 10. Install workspace dependencies and
build the local MACI packages before treating frontend errors as application defects:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The full build includes multiple projects and may require additional circuit/toolchain
resources. Record the actual failure if blocked; do not describe an unrun build as
green. The current documentation review ran only the targeted tests below, not a fresh
full dependency installation/build.

Copy `apps/front-end/.env.example` to `apps/front-end/.env.local` and replace the
historical poll configuration with verified values before a live demo. All `VITE_*`
values are browser-visible. Keep private backend/deployer values outside version control.

Frontend public configuration: `VITE_SELF_SCOPE`, `VITE_SELF_ENDPOINT`,
`VITE_MACI_ADDRESS`, `VITE_CHAIN_ID`, `VITE_POLL_ID`, `VITE_MACI_START_BLOCK`. Backend
verification reads `SELF_SCOPE`, `SELF_ENDPOINT`, `MOCK_PASSPORT`, and the server port
configuration. Frontend/backend scope, callback endpoint and mock environment must
agree. This main baseline has no Privy/paymaster environment contract. The separate W1
experiment does; use its reviewed server configuration and reconcile its docs on merge.

### B2. Start and check services

In separate terminals, from the repository root:

```sh
pnpm --dir apps/backend dev
```

```sh
pnpm --dir apps/front-end dev
```

The backend defaults to port 3100 and exposes `/health` and `/verify`. Check the actual
frontend origin printed by Vite; the backend CORS list currently does not include
default port 3000 (G10). Align the configuration/code before expecting browser
verification to work.

Enterprise migration staging needs a public HTTPS webhook endpoint, an operator-created
flow and frozen version, a test API key and the endpoint signing secret. Keep credentials
backend-only. Mount a raw-body handler before JSON middleware; do not log payloads.
The candidate below is not yet mounted. The old `/verify` endpoint and its QR are legacy
and cannot demonstrate the Enterprise path. A labeled mock-document round trip and a
real-document verification remain separate acceptance gates.

### B3. Provision browser proving assets

The vote flow references `/zkeys/PollJoining_10_test/` WASM and `.0.zkey` assets. They
are not present in this checkout's frontend public directory (G08). The repository
supplies `pnpm download-zkeys:test`, but downloading at the root does not automatically
serve assets through Vite.

Confirm the exact filenames in
[voteFlow.ts](../apps/front-end/src/hooks/voteFlow.ts), obtain the matching trusted
test artifacts, place or serve them at those URLs, and verify response bytes/hash and
circuit depth against the deployed configuration. Test keys/assets are for the labeled
test environment. Do not substitute mismatched depth or ceremony artifacts to make a
request return HTTP 200.

### B4. Select or deploy a poll

Before any deployment, settle S2.1 policy, account binding and ballot mode/credits.
Alejandro controls and funds deployer/voter accounts. Review
[Hardhat configuration](../packages/contracts/hardhat.config.ts) locally with the
operator; do not fall back to a test mnemonic on a public network.

The deploy task reads `Poll.pollStartDate` and `Poll.pollEndDate` in the selected
network's deploy configuration. These are **absolute UNIX seconds**, not relative
durations. Existing `3600` placeholders are not a future one-hour window. Set explicit
start/end times with enough time for verification and proving, and read them back after
deployment.

Inspect task help from the contracts package before constructing commands:

```sh
pnpm --dir packages/contracts exec hardhat deploy-poll --help
```

Existing scripts include:

```sh
pnpm --dir packages/contracts deploy:sepolia
pnpm --dir packages/contracts deploy-poll:sepolia
```

These mutate the chain and spend funds. The first deploys the broader stack; the second
deploys a poll against the configured deployment. They are alternatives selected after
reviewing policy/deployment state, not two mandatory quickstart commands. The task
catches/logs some failures, so a successful shell exit is insufficient evidence.

Verify chain ID, bytecode, MACI-to-poll address mapping, `getStartAndEndDate()`, policy
contracts, coordinator public key, mode/credits/options and circuit depths. Do not
assume the newest local JSON corresponds to the selected chain.

Commit a public deployment manifest when verified: date, operator, chain ID,
MACI/poll/policy/processor/tally addresses, poll ID, tx hashes and blocks, schedule,
mode, option count, circuit/artifact hashes, scan start, metadata hash and verification
block. Exclude keys and personal data. This manifest is a required future artifact, not
currently supplied proof.

### B5. Close, prove and publish results

Available contracts scripts are `merge:sepolia`, `prove:sepolia`, and
`submitOnChain:sepolia`. Inspect each underlying task's help and required
coordinator/proving artifacts before use. Keep coordinator secrets under operator control.

Verify each checkpoint: poll closed → state merged → messages processed/proofs accepted
→ tally commitment verified → aggregate results checked/published → Graph indexed → UI
displays the same values. Current integration is incomplete; follow A5 above. Never
mark merging alone as final results.

### B6. Build/deploy the subgraph

Edit schema sources in `apps/subgraph/schemas`, network config in
`apps/subgraph/config`, and YAML templates in `apps/subgraph/templates`; generated
`schema.graphql`/`subgraph.yaml` are not the canonical design inputs.

```sh
pnpm --dir apps/subgraph build
```

The default version is v1; v2 does not exist at the review baseline. Build invokes code
generation. The default deploy scripts name the upstream `maci-subgraph`; select a
project-owned Studio name and credentials explicitly before deploying. Record the
deployment/version, endpoint, network, indexed head, errors and a real query response.
Studio deployment alone does not connect the frontend or produce finalized tally data.

### B7. Verification commands and evidence

Current focused regression suite:

```sh
pnpm --dir apps/front-end test:unit
```

This runs `voteFlow`, `receipts`, `receiptStatus` and `hydration` tests (14 flow, 8
receipt-storage, Poll-publication and hydration-race tests). On Node 20 it uses
installed TypeScript; newer Node can use native stripping. Record the exact pass/fail
counts from the command; do not copy a previous snapshot. Supported-toolchain checks
for an implementation change include:

```sh
pnpm --dir apps/front-end build
pnpm types
```

Use the existing repository lint/format checks on changed files. These unit tests do
not exercise React component mount, actual Self proofs, browser proving, live chain
receipt provenance or tally/indexer correctness.

Record live smoke evidence under the [judge checklist](technology.md): exact release
commit, environment, public tx/query links, expected versus actual outcomes and
limitations. Do not capture passport details, raw proof payloads, secrets or ballot-key
material in recordings.
