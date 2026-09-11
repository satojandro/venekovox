# Privy migration analysis — replacing the injected EOA with an embedded/sponsored wallet

**Date:** 2026-09-11 · **Author:** Hermes · **Status:** analysis for review (not a plan)
**Depends on:** `~/Hermes-crypto-builder/venekovox-ethonline2026/W1-privy-report.md`
(the W1 vendor-compatibility research, MARGINAL-GO) and the W1 live-run recipe in the
hackathon-playbook skill (`references/w1-privy-sponsored-execution.md`).
**Trigger:** the blocker that cost days was a wallet-RPC problem in the injected Rainbow
EOA — the very thing W1 proposes to replace. This asks what actually changes.

---

## 1. The irony, examined precisely

The instinct — "an EOA wallet stopped us, and we're replacing the EOA wallet anyway" — is
half right, and the half that's wrong matters.

**What actually broke was not EOA-ness.** It was the assumption that _the wallet's RPC is
a reasonable place to perform reads_. `asReceiptProvider` called `MACI.getPoll` through
`new BrowserProvider(wallet)`; Rainbow's node rate-limited it (`-32005`) and ethers
misreported that as a reverting contract. The EOA was incidental — **any** wallet's
built-in RPC can do this.

**Consequence for the Privy work: the migration does not remove this failure class, it
re-sites it.** A Privy embedded wallet is an MPC/TEE-secured secp256k1 EOA whose provider
also fronts an RPC. If reads keep riding the wallet provider, the same symptom returns
with a different vendor in the stack trace.

The already-merged fix (`6a3d3cff2`: prefer `makeReadProvider(chainId)`, wallet only as a
last resort) is therefore a **prerequisite** for the migration, not something the
migration makes unnecessary. It is also the correct general shape: _reads never ride the
signer_.

**The genuine EOA-related win** is narrower and real: a sponsored transaction lets a
voter with **zero ETH** complete the journey. That is a product unlock, not a bug fix.

---

## 2. What changes, by layer

| Layer                           | Changes?                           | Detail                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Eligibility grant               | **Yes — address binding**          | The authorization tuple binds `account`; `SelfEligibilityPolicy.enforce` requires `a.account == subject` (subject = `msg.sender` at join). New wallet = new subject = **new grant = new passport scan.** |
| Grant signature verification    | **Depends on model**               | `accountControl` supports EOA / 7702 / ERC-1271, so a smart-account signature is acceptable — but the model must be chosen deliberately.                                                                 |
| Join / `msg.sender`             | **Depends on model**               | See §3. Embedded/7702 → EOA address (unchanged semantics). 4337 → a **contract** address.                                                                                                                |
| `publishMessage` call           | **No**                             | MACI takes a public key as calldata and the repo has **no `ecrecover`/`ECDSA`** usage, so v3 is contract-account friendly at signup/publish.                                                             |
| **Receipt verifier**            | **YES — breaks under sponsorship** | See §4. This is the concrete code change.                                                                                                                                                                |
| Read path                       | **No — but must be preserved**     | Reads stay on the public `FallbackProvider`. The migration must not reintroduce wallet-RPC reads.                                                                                                        |
| Chain switching / `assertChain` | **Yes — UX**                       | `window.ethereum` assumptions move to the Privy provider or an EIP-1193 shim.                                                                                                                            |
| Uniqueness / identity tag       | **Yes — operational risk**         | See §5.                                                                                                                                                                                                  |
| Uniqueness of the _person_      | No                                 | `identityTag` = HMAC(ZKPassport `uniqueIdentifier`), independent of wallet.                                                                                                                              |
| Gas / UX                        | **Yes — the actual prize**         | App-pays sponsorship; voter needs no ETH.                                                                                                                                                                |

---

## 3. The three account models (W1, verified)

| Model                                     | `msg.sender` at join/publish          | MACI/eligibility impact                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embedded wallet** (MPC/TEE EOA)         | the EOA address                       | MACI-native; simplest. Wallet still has an RPC → §1 applies.                                                                                                                    |
| **EIP-7702 delegation** _(W1 primary)_    | **the EOA address** (unchanged)       | MACI-native. Sepolia explicitly supported in Privy's own 7702 guide. No separate deployment.                                                                                    |
| **ERC-4337 smart wallet** _(W1 fallback)_ | the **smart-wallet contract** address | Still stable and unique — MACI keys state by signer address — but it is a contract, so `accountControl` must accept ERC-1271 and the grant must bind the smart-account address. |

`msg.sender` semantics are decided **before** the adapter is written. Switching model
afterwards invalidates every grant already issued and every receipt already filed.

---

## 4. The concrete breakage: the receipt verifier

`apps/front-end/src/lib/receiptStatus.ts` — `isDirectEoaPublication` requires:

```ts
sameAddress(tx.to, pollAddress) &&
  sameAddress(tx.from, account) &&
  isPublishCalldata(tx.data) &&
  hasPublishMessageFrom(receipt, pollAddress);
```

**With a sponsored ERC-4337 userOp this is false by construction.** W1's live run
recorded the outer transaction as:

| Field                       | Observed on a sponsored op                                                      |
| --------------------------- | ------------------------------------------------------------------------------- |
| Outer tx `from`             | **the bundler** (`0xaf02…`) — not the participant                               |
| Outer tx `to`               | **EntryPoint v0.7** `0x0000000071727De22E5E9d8BAf0edAc6f37da032` — not the poll |
| `UserOperationEvent` topic0 | `0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f`            |
| Event `sender`              | the participant's smart account ✓                                               |
| Event `success`             | **`0` even when the outer tx mined with `status 0x1`**                          |

So under 4337 the app would show a **successful vote as unverified** — the receipt check
looks at the wrong two fields. Under EIP-7702 the outer tx is still from the EOA and to
the poll, so `from`/`to` hold and the current verifier survives; that is a further reason
W1 ranked 7702 primary.

**Required change if 4337 is ever adopted:** verification must read the EntryPoint
`UserOperationEvent` for _this_ userOp hash — resolve sender/success from the event, not
from the receipt's `from`/`to`. Also: **outer success ≠ op success**; the event's
`success` flag is the only truth.

---

## 5. Identity and uniqueness consequences

1. **A new wallet address means a new grant and a new passport scan.** The grant binds
   `account`; it does not transfer.
2. **Switching wallets after a consumed grant burns the tag for that poll.**
   `enforce()` sets `usedIdentityTags[identityTag] = true` and `usedAccounts[subject] = true`
   (`SelfEligibilityPolicy.sol:110-112`). The tag is derived from the _passport_, so the
   same person rejoining poll 1 from a different address is rejected — which is correct
   one-person-one-vote behaviour, and exactly why the provider must be settled **before**
   a real grant is consumed on any poll that matters.
3. The 900s grant window (§3.2 of the runbook) is unaffected — it is a contract constant.
4. Sponsorship does not change what is public: the poll still sees a publication from a
   registered state index, never an option choice.

---

## 6. What does **not** change

- The MACI contracts and circuits. No change to `publishMessage`, the poll, or the tally.
- `SelfEligibilityPolicy` and the EIP-712 authorization shape.
- The eligibility criteria (backend env + on-chain `configId`).
- The subgraph (WP4) and the Studio deployment — they index events, and the events are
  the same.
- The requirement that **reads ride a public RPC**.

---

## 7. Gates to close before writing adapter code (from W1)

These are unchanged and still `unverified`; both are dashboard checks measured in
minutes, and either failing strands the goal:

1. **TEE execution.** Privy's own docs require TEE wallets for native gas sponsorship. If
   the app is on legacy on-device wallets, sponsorship is unavailable until migrated.
2. **Sepolia enabled for sponsorship.** Chains are explicitly configured; testnet
   availability is not assumed.

Then, from the W1 live run — **do not repeat this**: Privy's _server-RPC_ sponsored path
was **not viable** for userOps on a 7702-delegated Kernel account (validation failed with
`AA23 … revertData 0x8baa579f` = `InvalidSignature`; `paymaster = 0x0` was a symptom of
failing at validation, not a missing policy). The unsponsored control proved the wallet
itself executes fine. **Production must use the client SDK** so the user's own auth
signature satisfies the validator; the server-RPC path is a debugging instrument.

---

## 8. Bottom line

|                                         |                                                                                                                                                             |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does Privy fix the bug that blocked us? | **No.** The bug was reading through a wallet RPC. Keep `6a3d3cff2` and extend the same rule to the Privy provider.                                          |
| What does Privy buy?                    | A voter with **zero ETH** can complete the journey — a real product unlock, and the S2.2 goal.                                                              |
| Biggest code change                     | The **receipt verifier**, and only if 4337 is chosen. Under 7702 it survives as-is.                                                                         |
| Biggest non-code risk                   | Deciding the account model late — it invalidates consumed grants and the passport tag per poll.                                                             |
| Recommendation                          | Stay on **EIP-7702 + `sponsor: true`** (W1 primary). It keeps `msg.sender` = the EOA, keeps the receipt verifier valid, and keeps the grant binding intact. |
