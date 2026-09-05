# Integration specifications

**Design contract, not an implementation claim.** Baseline and gaps: [current state](current-state.md). Product decisions: [register](decisions.md). The following interfaces describe required behavior; names are illustrative unless explicitly tied to source.

## 1. Self → eligibility policy → MACI (P2)

Existing entry points: [Self verifier](../apps/backend/src/routes/verify.ts), [MACI contracts](../packages/contracts/contracts). MACI signup calls `signUpPolicy.enforce(msg.sender, data)`; poll joining calls its configured policy with the caller. Current frontend gate data is empty. A browser verification flag is not a credential.

### Required handshake

1. Establish the actual participating account and configured chain. With a smart wallet, use the smart account address, not its owner/embedded signer address.
2. Create a short-lived verification challenge bound to the intended action and domain. Prove control of the participating account with a method that supports its account type; do not assume EOA-only signature recovery works for smart accounts.
3. Build the Self Pass request with matching frontend/backend scope, endpoint, environment and eligibility policy. The current UUID user context alone does not prove control of a wallet.
4. Verify the proof and its authenticated context server-side or in the selected on-chain verification path. Do not accept a client-supplied account/nullifier without proving the binding.
5. Produce or validate policy authorization scoped to chain, policy/contract, account, action and expiry. Include poll scope when required, a replay identifier, and MACI-key binding if chosen by the policy design.
6. Enforce eligibility and uniqueness in the contract path. Consume authorization atomically with successful registration/join. Reject replay, expiry, wrong account/domain/poll, invalid proof and direct bypass.
7. Expose eligibility state to the UI without publishing raw document attributes or stable identity linkage unnecessarily.

### Decisions before deploying

| Decision                 | Constraint                                                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verification bridge      | Direct proof/credential verification versus backend-issued authorization; document issuer trust, revocation and supported chain compatibility             |
| Unique participant scope | Define per-MACI registration and per-poll participation behavior; Self nullifier semantics must be verified, not inferred from MACI membership nullifiers |
| Account changes          | A second wallet must not become a second eligible human. Define migration/recovery without reopening duplicate membership                                 |
| Eligibility              | Minimum age, document support and any location restrictions are product policy, not incidental SDK defaults                                               |
| Ballot semantics         | Select voting mode, voice credits, choices and update rules explicitly; current default weight/nonce does not prove one-person-one-choice tally semantics |
| Data handling            | Remove unnecessary nationality/gender disclosure and full response/log payloads, or explicitly justify them; define retention and access                  |

Negative acceptance cases: bypass Self UI; reuse authorization from another account or poll; change chain; use expired/replayed authorization; use two wallets for the same scoped identity; interrupt after registration before join; recover and retry. Demonstrate both eligible and ineligible paths against the actual deployed policy.

Demographic analytics attributes (see [demographic-analytics-spec](demographic-analytics-spec.md)) are a separate, consented, versioned collection policy. They do not undo the eligibility-path minimization (G09): the eligibility verifier still minimizes nationality/gender disclosure and logging, and analytics collection never re-introduces raw disclosure payloads into eligibility responses or logs.

## 2. Wallet and sponsorship adapter (W1)

Current [useMaci](../apps/front-end/src/hooks/useMaci.ts) depends on `window.ethereum` and an ethers signer. Preserve the proven flow's context checks while replacing this coupling through the [WalletAdapter](../apps/front-end/src/lib/wallet/adapter.ts) seam. The injected path remains the only approved source until [W1 experiment](w1-experiment.md) E1–E6 pass.

An adapter must expose: readiness/authentication, noninteractive account/chain inspection, explicit connect, account-change subscription, a compatible contract execution path, and transaction confirmation. Capture `{chainId, maciAddress, pollId, account}` once per operation; validate context before each new submission and every UI write. Switching accounts cannot cancel an already-broadcast transaction; retain its original context. Signup, join and publish must use **one participating address**.

**Sponsored execution is a different transaction shape than P1.** The Poll may observe `msg.sender` as the user's account while the outer transaction comes from a relayer/bundler and targets an account or EntryPoint. P1's checks (`from` = participant, `to` = Poll, calldata = `publishMessage(Batch)`) do not transfer. Confirm sponsored publications with the [sponsored-execution verifier](../apps/front-end/src/lib/sponsored/verifier.ts): reconcile vendor `transaction_id` / `user_operation_hash` (pending / confirmed / reverted / failed / denied / outcome-unknown) **and** inner Poll `PublishMessage` plus observed inner caller. A mined bundle is not user-operation success. A null RPC receipt is pending, not vendor failure. A timeout after broadcast is outcome unknown, not "nothing happened."

Do not treat an untested EIP-1193 `eth_sendTransaction` shim as proof that the vendor's sponsorship/user-op path ran. A working user-funded signer is a separate claim. Keep sponsor credentials on the [backend proxy](../apps/backend/src/routes/sponsoredStatus.ts), never in the Vite bundle. Denied/exhausted sponsorship must throw a recoverable error and must not silently spend the user's ETH.

EIP-7702 (account code) and ERC-4337 (bundlers) can be used together; 7702 delegation persists until changed or cleared. MACI `signUp` / `joinPoll` policies enforce `msg.sender`; `publishMessage` does not authenticate by sender-vs-signup. Test policy + caller + MACI key + execution path together. Batching APIs do not make signup, join (zk proving) and publish one atomic transaction.

Privy is the first experiment (D06 provisional), not a selected stack. Dynamic is only in play if enterprise sponsorship is granted. Prototype compatibility with the experiment protocol before a provider-wide rewrite.

Acceptance: a new participant with zero ETH completes the chosen journey, refreshes and recovers correct state; injected fallback still works; rejected sponsorship, session expiry and account/network changes are recoverable. Record actual caller, outer vs inner identity, vendor ids, tx hashes and gas-payment evidence. Vendor configuration alone is not completion. Architecture approval requires E1–E6 evidence.

### MACI key lifecycle

Wallet keys, MACI signing keys and encryption randomness have separate purposes. Never derive or log secret voting material casually. Current global browser storage is a known gap, not a recovery strategy. Decide scope and migration of existing keys before changing storage: discarding a registered key can strand membership. Hydration should read an existing key and show a missing/recovery state rather than generate a replacement silently. Specify multi-device, logout, account switching and lost-browser behavior before promising recovery.

## 3. ENS profile → application (E1)

ENS supports navigation and a persistent public pseudonym. Resolve it from the actual participating account using the selected ENSv2 Sepolia deployment. Support missing name, failed resolver, reverse/forward mismatch and name collision; retain an address fallback.

Desired subnames are persistent, nontransferable and without expiry. Verify those properties against the chosen registry/registrar implementation and define profile recovery; they are requirements, not existing contract guarantees. A successful name resolution must never skip Self verification or grant MACI membership.

Do not publish Self nullifiers, private voting keys, document attributes or ballot choices in ENS records. Explain that associating a name with a participating address can expose public transaction history and recurring participation metadata.

Acceptance: a real registered/resolved name changes the live user experience; another user's name cannot authorize participation; unresolved names degrade gracefully; transaction and registry/resolver evidence is recorded.

## 4. Poll metadata → contract lifecycle → UI (P3)

Proposed descriptor fields: schema version, chain ID, MACI address, poll ID and resolved poll address, question, immutable ordered option IDs/text, content hash/URI, creator/provenance, eligibility-policy identifier, voting mode/credits and locale. The binding between descriptor and on-chain option indexes must be integrity-protected; a mutable UI array can otherwise change what a vote means.

Read start/end timestamps, membership policy and tally status from the selected contracts. If metadata and deployment disagree, disable submission and surface the mismatch. Distinguish scheduled, open, closed, processing, verified and published states. A loading/failing query is not an empty poll.

M1 may ship a validated static descriptor for one operator-created poll. Later creation must persist the descriptor and link the deployed poll atomically or with explicit recoverable intermediate states. Replace mock counts/results; never reuse their numbers while real data loads.

## 5. MACI → verified tally → The Graph (P4/T5)

The coordinator processes messages and produces proofs; contracts verify the tally commitment. `Tally.sol` exposes tally state and result submission/checking, but currently has no dedicated result events. `MergeState` alone cannot trigger a claim that results are final.

Choose a supported strategy before implementation: a documented contract extension emitting verified result events, or suitable chain-supported call/block indexing of verified tally state. Account for dynamic poll/tally addresses, completeness of all options, result publication and the limitations of the target Graph network. An unauthenticated JSON result file is not authoritative simply because its author is the coordinator.

Index provenance: chain/contract/poll, proof/result transactions or equivalent verified-state evidence, indexed block, tally commitment, finalization state and schema version. Publish aggregate values only after the selected verification checks pass. Handle indexer lag/reorgs and missing results without substituting zero.

Acceptance: close a small known poll, process/prove, verify on-chain, publish checked results, query them through the live endpoint and render the same aggregate values. Invalid/unverified data must not appear as finalized results. Record the fixture's methodology and keep private participant secrets out of evidence.

## 6. Native MACI schema → Messari-derived schema (T4)

Reference: [Messari OpenZeppelin Governor schema](https://github.com/messari/subgraphs/blob/master/subgraphs/openzeppelin-governor/schema.graphql). This is a versioned extension design, not “Messari compatibility” established by copying names.

| Source-model issue                                                              | Required design treatment                                                                                        |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Required token/timelock/delegate concepts do not describe every civic MACI poll | Do not invent addresses, delegates or token-holder counts; define optionality or a separate compatible interface |
| Standard Vote requires choice, voter and weight                                 | Private individual choices cannot be populated from ciphertext; do not publish fabricated zero/abstain votes     |
| Native `Vote` already means encrypted message                                   | Resolve entity naming collision explicitly; preserve message semantics separately                                |
| Binary Governor tally versus arbitrary civic options                            | Preserve ordered option IDs and methodology; only compare compatible quantities                                  |
| Missing individual data versus zero participation                               | Represent unavailable/private data distinctly from measured zero                                                 |

Propose separate fields for ballot visibility, coordinator trust and tally finalization. A `BallotPrivacy` extension alone cannot express all three. Maintain public aggregate compatibility where meaningful; document breaking changes, nullable fields and adapter behavior. Snapshot the exact upstream schema commit used during implementation.

A shared schema does not automatically create one query across deployed subgraphs. Choose either a combined indexer for compatible deployments or a client/API composition layer across endpoints. Record endpoint, network, freshness and methodology per source. The demonstration must show useful comparative information without implying unlike voting systems have equivalent populations or weights.

## 7. Graph → agents → controlled poll creation (T6/A1)

Start with read access to finalized public aggregates and poll metadata. The agent should answer with poll identifiers, source links, sample/methodology limits and freshness; treat unfinalized data as unfinalized. Never expose private keys, individual decrypted choices, Self payloads or backend credentials through MCP.

Creation uses the same validated service as human creation: authenticated creator, question/options/eligibility/schedule validation, quota and idempotency key, then operator/deployment status. An x402 payment and a chain deployment are not atomic: define retry, duplicate prevention and paid-but-not-created recovery before charging real value.

Bazantic qualification requires its actual supported gateway/Recipe workflow, not a similarly named local README. Compare the same prompt/model/settings/API access with and without the Recipe and retain evidence. News/resource generation needs source provenance and a bounded publication/review policy. Agent creation never implies permission to vote as a verified person.
