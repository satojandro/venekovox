# Integration specifications and runbook

**Design contract, not an implementation claim.** Baseline and gaps:
[status.md](status.md). Product decisions: [roadmap.md](roadmap.md). Call-by-call
truth: [journey-map.md](journey-map.md). The following interfaces describe required
behavior; names are illustrative unless explicitly tied to source.

---

## Part A — Integration specifications

### A1. Self → eligibility policy → MACI (S2.1)

Existing entry points: [Self verifier](../apps/backend/src/routes/verify.ts),
[MACI contracts](../packages/contracts/contracts). MACI signup calls
`signUpPolicy.enforce(msg.sender, data)`; poll joining calls its configured policy
with the caller. Current frontend gate data is empty (`0x`). A browser verification
flag is not a credential.

#### Required handshake

1. Establish the actual participating account and configured chain. With a smart wallet, use the smart account address, not its owner/embedded signer address.
2. Create a short-lived verification challenge bound to the intended action and domain. Prove control of the participating account with a method that supports its account type; do not assume EOA-only signature recovery works for smart accounts.
3. Build the Self Pass request with matching frontend/backend scope, endpoint, environment and eligibility policy. The current UUID user context alone does not prove control of a wallet.
4. Verify the proof and its authenticated context server-side or in the selected on-chain verification path. Do not accept a client-supplied account/nullifier without proving the binding.
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

Self Pass's mobile proof callback needs a publicly reachable verifier for the staging
flow; localhost on the developer machine is not reachable from a phone. Configure a
public HTTPS tunnel or deployment, then align the exact request/verifier endpoint. Use
Self's supported mock-passport environment for staging, visibly labeled. It still
exercises the mobile proof flow; a stubbed browser callback is not equivalent. A
real-document verification remains an M1 gate.

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
