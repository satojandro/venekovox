# Refresh hydration + vote receipts — P1 slice 2

Follow-up to `vote-flow-review.md`. Implemented after Astra's review of
`19c3bae08`. One acceptance test covers both features: **submit → refresh →
reconnect → see the correct participation and submission state.**

## What changed

### Hydration (`useMaci.ts`)

On mount — and again on every `accountsChanged` / `chainChanged` event — the
hook inspects the ALREADY-connected wallet (via `eth_accounts`, which never
pops a connection prompt) and restores state from the chain:

- **Participation** (`registered`, `stateIndex`, `pollStateIndex`) comes from
  the SDK's on-chain lookups (`getSignedupUserData`, `getJoinedUserData`),
  anchored at `VITE_MACI_START_BLOCK` to avoid a genesis scan.
- **States:** `checking` → `ready` | `disconnected` | `lookup-failed`.
- **A failed chain lookup is `lookup-failed`, never "not registered."** Not
  knowing is a different answer than a "no" — this distinction is load-bearing
  for trust in the results story.
- **Stale-request discipline:** every state write is guarded by
  mounted-ness, a generation counter (bumped by wallet events), the busy lock,
  and the live submission status. A hydration that loses a race to a newer
  submission discards itself; it can never overwrite newer state.

### Receipts (`src/lib/receipts.ts`)

A receipt records that an encrypted vote message was **submitted**. It is NOT
proof the vote was counted (that is P4's tally domain).

- **Key = chainId + MACI address + pollId + wallet address** (lowercased). The
  context IS the namespace: a receipt cannot be loaded under a different
  chain, contract, poll or wallet.
- **Stored data:** transaction hash + submission time only. Never the selected
  option, never a "counted" claim.
- **Failure semantics:** missing, corrupt or malformed storage always reads as
  "unable to confirm", never "confirmed". A throwing store does not fail an
  already-submitted on-chain vote.
- **Storage is injectable** (`ReceiptStorage`): the embedded-wallet /
  smart-account integration (Astra, in flight) replaces localStorage without
  touching the vote flow.

### Wallet-switch display guard (the regression Astra caught)

The hook already suppressed stale _progress_ after a wallet change, but the
page could still receive the completed _promise_ and render A's transaction
under B. Fix at both layers:

- The flow captures chain/account/MACI/poll **when submission starts**, saves
  the receipt under that captured context, and returns it in the result.
- The page only renders the confirmation if the completing account is still
  the live one; on any account change it clears local submission display.
  A's receipt stays safely filed under A.

### UI (`PollDetail.tsx`)

The confirmation panel is now driven by the **validated receipt** (receipt
present AND `receiptAccount === account`), not by transient React state — so a
reload restores "submission confirmed" from persisted truth, with the tx hash.
Vote buttons disable off the same validated receipt.

## Tests

- `apps/front-end/tests/voteFlow.test.mjs` — 14 tests: the original flow
  regressions plus submission-context capture, the wallet-switch receipt
  regression, and a throwing-store case.
- `apps/front-end/tests/receipts.test.mjs` — 5 tests: context-scoped keys,
  roundtrip, corrupt/malformed → unconfirmed, cross-wallet isolation,
  unavailable-storage semantics.

Run: `pnpm test:unit` from `apps/front-end` (or `node --test tests/`).

## Deliberately remaining

- Account-scoped MACI voting-key migration (browser-wide key storage is
  preserved; receipt scoping does not disguise this).
- Vote updates / nonce semantics remain unsupported by design.
- Participation hydrates on the next interaction in the worst case; no full
  voter dashboard yet (P3 territory).
- Wallet access is still direct `window.ethereum`; the replaceable wallet
  interface lands with the smart-wallet/sponsorship work before P2's
  deployment decision.
