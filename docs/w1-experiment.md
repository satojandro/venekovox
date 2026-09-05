# W1 experiment protocol (Privy first)

**Status:** Architecture **not approved**. D05 = accepted direction (sponsored onboarding + injected-wallet fallback). D06 = **provisional**: Privy first; Dynamic only if enterprise sponsorship is granted. The exact execution stack is selected **after** E1–E6 have evidence.

**Task ID / owner / date:** W1 / this implementation session / 2026-09-05  
**Base commit and working branch:** `05d8f2a3` (`p1-poll-receipt-verification`) / `w1-privy-experiment`  
**Goal and acceptance gate:** Make the experiment runnable and the sponsored verifier testable. Do **not** treat a dashboard toggle, an ethers sketch, or “7702 preserves the address” as P1 compatibility.

## Corrected assumptions

1. **Sponsored execution is not a direct EOA transaction.** The Poll may see the user’s account as `msg.sender` while the outer transaction is from a relayer/bundler to an account or EntryPoint. P1’s checks (`from` = participant, `to` = Poll, calldata = `publishMessage`) do not transfer. W1 uses a **sponsored-execution verifier**.
2. **EIP-7702 and ERC-4337 are not mutually exclusive.** 7702 assigns code to an existing account; 4337 is execution infrastructure. Delegation **persists** until changed or cleared ([EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)).
3. **A transaction hash is useful and insufficient.** Privy’s backend returns `transaction_id` + `user_operation_hash` at broadcast; client SDKs wait before returning a hash ([transaction handling](https://docs.privy.io/wallets/gas-and-asset-management/gas/transaction-handling)). A mined bundle is not proof that **this** user operation succeeded. A null RPC receipt is pending (propagation), not vendor failure. A timeout after broadcast is **outcome unknown** until reconciled.
4. **Adapters in vendor reports are sketches.** Forwarding `eth_sendTransaction` to `client.transport.request` does not prove sponsorship/user-op logic runs. A working user-funded signer does not prove the sponsored path.
5. **MACI compatibility is under-proven.** `publishMessage` does not authenticate a ballot by comparing `msg.sender` to signup. Signup/join **policies** call `enforce(msg.sender, data)`. Absence of `ecrecover` is not full compatibility. Test policy + caller + MACI key + execution path together. Batching APIs do not make signup → join (in-browser proof) → publish one atomic transaction.

## Experiment gate (run before wiring Privy into voting)

| # | Experiment | Evidence |
| --- | --- | --- |
| E1 | Enable Sepolia sponsorship (TEE + App pays + Sepolia) | App entitlement, pinned SDK, chain list |
| E2 | Zero-ETH sponsored call to `CallerProbe` | Contract caller vs outer `from`/`to`, delegation (`0xef0100`), gas payer |
| E3 | Deliberate revert | User-op failure distinct from outer tx success |
| E4 | Refresh during submission | `transaction_id` survives reload; pending/confirmed/failed/unknown |
| E5 | MACI signup, join, publish **separately** | Per-step ids; poll `msg.sender` matches E2 account; join proof accepted |
| E6 | Deny sponsorship | Explicit failure; injected adapter must not silently pay ETH |

Exit: all six pass with recorded evidence → architecture for that vendor may be approved. Any fail → NO-GO unless it is clearly configuration-only and re-testable.

Lab UI: [`/w1`](../apps/front-end/src/pages/W1Experiment.tsx). Marking rows “pass” in the browser is a notebook, not live verification.

## What this change implements (and what it does not)

**Implemented**

- `CallerProbe` / `ProbeForwarder` plus `deploy-caller-probe` (Alejandro runs it; agents do not handle keys).
- Sponsored verifier: trusted EntryPoint `UserOperationEvent` for **this** user-op hash; Poll `PublishMessage` only counts when `linkedToUserOperation` is set (bundle co-presence is not enough). Outer `from`/`to` are informational.
- Durable `transaction_id` lab draft (E4 restore); hash may be missing at save time.
- `WalletAdapter` seam: injected path is real; `createPrivyAdapter()` throws until E1–E6 pass.
- Thin `GET /w1/transactions/:id` using server-side credentials (status GET failures are unavailable, not denied).
- Lab-only `POST /w1/lab/sponsored-send` (gated by `W1_LAB_ALLOW_SPONSORED_SEND`); not wired into production voting.

**Not implemented / not claimed**

- No `@privy-io/react-auth` dependency and no ethers `transport.request` shim.
- `useMaci` still uses the injected wallet and the P1 receipt verifier.
- No live Sepolia sponsored tx, no TEE/dashboard entitlement proof, no MACI E5 run.
- Operation↔publication linkage for real Poll publishes still requires stack-specific evidence before `linkedToUserOperation` can be set in production.

## Operator commands (no private keys in chat)

Deploy the probe (Alejandro’s environment):

```sh
pnpm --dir packages/contracts exec hardhat compile
pnpm --dir packages/contracts exec hardhat deploy-caller-probe --network sepolia
```

Frontend unit tests:

```sh
pnpm --dir apps/front-end test:unit
```

Local CallerProbe shape tests (needs contracts `node_modules`):

```sh
pnpm --dir packages/contracts test tests/CallerProbe.test.ts
```

Set on the **server** only: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`. Optional: `W1_WEBHOOK_SECRET`. For lab sponsored sends: `W1_LAB_ALLOW_SPONSORED_SEND=true` and `W1_LAB_WALLET_ID`. Frontend: `VITE_W1_BACKEND_URL`, `VITE_W1_PROBE_ADDRESS` (the probe address is not a secret).

## Next concrete action

Alejandro: E1 dashboard (TEE + Sepolia sponsorship) and deploy `CallerProbe`. Then E2 from a zero-ETH embedded account. Do not wire Privy into `submit.ts` until E1–E6 pass.

External setup: Privy app access and funded deployer remain with Alejandro.
