# Refresh hydration and receipt recovery

Slice implemented in `68f658cf`, reviewed at `7fce1e1` on 2026-09-05. This replaces the earlier description that overstated validation and race protection. Open findings are G02–G04/G11 in [current state](current-state.md).

## Implemented behavior

[useMaci.ts](../apps/front-end/src/hooks/useMaci.ts) attempts mount/account/chain-event hydration from already-connected wallet state and SDK signup/join lookups. It includes generation/busy guards, though not all writes are guarded. The vote flow captures submission context and the page suppresses confirmations belonging to another account.

[receipts.ts](../apps/front-end/src/lib/receipts.ts) stores transaction hash and submission time under chain + MACI + poll + wallet. It does not store the selected option. Context scoping prevents ordinary cross-context cache lookup, but is not proof of transaction provenance. Local storage is user-editable and can be unavailable.

P1 follow-up (2026-09-05) tightened the truth contract, then a review at `c6e1fa874` showed the first verifier checked the **MACI recipient** rather than a Poll publication. The current contract:

- **Strict shape (G11).** `parseStoredReceipt` accepts only a real `0x`-prefixed 64-hex transaction hash and a finite positive timestamp, and labels the failure reason (invalid-json / invalid-tx-hash / invalid-time). Any malformed record loads as `null` = "unable to confirm".
- **Chain verification (G02, still partial).** [receiptStatus.ts](../apps/front-end/src/lib/receiptStatus.ts) resolves the poll through `MACI.getPoll`. **Confirmed** requires the participating account to call `publishMessage` or `publishMessageBatch` on that Poll (calldata + `to`) and that Poll to emit `PublishMessage`. The constructor's placeholder `PublishMessage` is not a vote. A successful MACI signup is `unexpected`. Unknown indirect execution (EntryPoint / smart account) stays `unverified` until a W1 adapter exists. Generic log-topic address matching is not used.
- **Marker retry + distinct states (G03, still partial).** [hydration.ts](../apps/front-end/src/lib/hydration.ts) peeks before any write. Duplicate/in-flight/busy/stale runs cannot blank the display and then skip restore. An operation/receipt revision invalidates in-flight hydration when a submission starts, so a delayed RPC cannot overwrite a newer receipt. Each hydration run owns the in-flight lock (`FlightAnchor`): a new submission invalidates an older run's lock, and cleanup releases only the lock that exact run acquired — so a delayed hydration finishing after a vote no longer leaves the account permanently "in flight" (regression added with `dcf63d545`). The marker is set only after participation lookup **and** the receipt check attempt. A unit race harness covers overlapping peek/lookup/receipt/submit/event cases including delayed overwrite and stale cleanup after a submission. There is still no React/browser mount harness.
- **Post-submit status.** After `publish` the hook verifies immediately and exposes a guarded `recheckReceipt` for pending/unavailable/unverified/unexpected. Persistence errors do not skip in-memory display and verification. Users should not need a reload to leave `unverified`.
- **Read-only key (G04 guard).** Hydration now reads existing key material and surfaces missing/invalid/storage-error states instead of silently creating a new voting identity on page load. An explicit vote still creates a key when needed.

The poll page shows participation notices even when no account is in React state (so wrong-chain is not hidden behind "Connect Wallet"), keeps vote buttons visible next to a reverted receipt, and offers "Check again" for recoverable statuses.

## Required recovery contract

1. Inspect account/chain without prompting. Distinguish no provider, disconnected, wrong chain and failed lookup.
2. Snapshot context and generation. Guard initial resets and every later state write. A refresh lookup must not overwrite a newer submission or wallet context.
3. Read existing key material; expose missing/corrupt/recovery state. Do not silently create a new identity during read-only hydration.
4. Look up signup and poll membership. A failure is unknown/retryable, not “not registered”. Clear or invalidate hydration markers appropriately after failure.
5. Parse stored receipts strictly, then query the configured chain. Verify successful inclusion and expected poll publish evidence. For smart accounts, support the actual execution/event context rather than assuming outer transaction `from` equals the participant.
6. Distinguish cached/unverified, pending, failed, confirmed and temporarily unavailable. A not-found receipt may be pending or unavailable; do not infer failure from one lookup.
7. Keep “submission confirmed” separate from “counted”. Indexer lag and tally finality have separate states.
8. Storage failure must not erase the useful in-memory result of an already-confirmed submission. Keep receipt ownership anchored to the original captured context.

Transaction matching must be specified against the deployed ABI and execution model; hash format alone cannot establish that the expected encrypted publish occurred. Define confirmation depth/reorg handling in the deployment profile and recheck stale cache entries.

## Acceptance

Run submit → refresh → reconnect, then repeat with wallet/network switches during hydration and submission. Cover failed RPC lookup/retry, pending/reverted/unrelated transaction hashes, malformed/unavailable storage, missing voting key and smart-account execution. Assertions must observe actual hook/UI behavior for race cases.

Current 14 flow, 8 receipt-storage, Poll-publication, and hydration-race unit tests are listed in [runbook](runbook.md). They do not prove React hydration race safety or live receipt validation. There is no complete voter dashboard claim.
