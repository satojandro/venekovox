# Refresh hydration and receipt recovery

Slice implemented in `68f658cf`, reviewed at `7fce1e1` on 2026-09-05. This replaces the earlier description that overstated validation and race protection. Open findings are G02–G04/G11 in [current state](current-state.md).

## Implemented behavior

[useMaci.ts](../apps/front-end/src/hooks/useMaci.ts) attempts mount/account/chain-event hydration from already-connected wallet state and SDK signup/join lookups. It includes generation/busy guards, though not all writes are guarded. The vote flow captures submission context and the page suppresses confirmations belonging to another account.

[receipts.ts](../apps/front-end/src/lib/receipts.ts) stores transaction hash and submission time under chain + MACI + poll + wallet. It does not store the selected option. Context scoping prevents ordinary cross-context cache lookup, but is not proof of transaction provenance. Local storage is user-editable and can be unavailable.

P1 follow-up (2026-09-05) tightened the truth contract:

- **Strict shape (G11).** `parseStoredReceipt` accepts only a real `0x`-prefixed 64-hex transaction hash and a finite positive timestamp, and labels the failure reason (invalid-json / invalid-tx-hash / invalid-time). Any malformed record loads as `null` = "unable to confirm".
- **Chain verification (G02).** [receiptStatus.ts](../apps/front-end/src/lib/receiptStatus.ts) checks the receipt on-chain during hydration: only a mined, successful transaction to the configured MACI contract renders as "confirmed". The UI now distinguishes `unverified` (just submitted), `pending`, `confirmed`, `unexpected` (right chain, wrong contract), `reverted` and `unavailable` (RPC failed — never "failed").
- **Marker retry + distinct states (G03).** The hydrated-context marker is set only after a successful lookup, so transient failures retry; wallet probe errors are no longer collapsed into "disconnected"; a wallet on the wrong chain gets its own state and is never hydrated cross-chain.
- **Read-only key (G04 guard).** Hydration now reads existing key material and surfaces missing/invalid states instead of silently creating a new voting identity on page load. An explicit vote still creates a key when needed.

The current hydration path still does **not** match chain events to the specific poll message (it verifies the receipt and recipient, not the emitted `PublishMessage`), and smart-account execution-context matching remains dependent on W1.

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

Current 14 flow and 5 receipt unit tests pass with test doubles. They do not prove React hydration race safety or live receipt validation. See [runbook](runbook.md) for the exact command. There is no complete voter dashboard claim.
