# Live-test runbook — running and debugging the real polling journey

**Status:** proven 2026-09-11 (first verified on-chain vote, poll 1).
**Audience:** any agent or session picking this up cold.
**Authority:** [status.md](status.md) for state, [journey-map.md](journey-map.md) for the
call-by-call map. This file is the _operational_ layer: how to run it, how it fails, and
how to find out why.

---

## 1. What "working" means

The Stage-1 journey is proven end-to-end with a real passport:

```
scan (ZKPassport)  →  EIP-712 grant  →  joinPoll  →  encrypted publishMessage  →  receipt
```

Verified evidence (Sep 11, 2026):

| Step         | On-chain artefact                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| Join         | `0x412bbbedc458eaabbc04a77cba728e5f2c36b708136dc84bb384aeaa178bd73c` — block 11683168                            |
| Vote         | `0x9328a656bcc822fc876472d56fac7a02546733047effb0f5dd20b03947e6cb18` — block 11683170                            |
| Join event   | `PollJoined` (`0x0a572bce…`), `pollStateIndex = 1`, `voiceCreditBalance = 99`                                    |
| Vote event   | `PublishMessage((uint256[10]),(uint256,uint256))` (`0x4be9ef9a…`), 384 bytes = 320 ciphertext + 64 ephemeral key |
| Same tx      | `ChainHashUpdated(uint256)` (`0xca4eaea2…`)                                                                      |
| Local index  | `joinedParticipants: 1` @ 11683180                                                                               |
| Studio index | `registrationCount: "1"` @ 11683180, `hasIndexingErrors: false`                                                  |

Tally / result decryption (**S4.1**) is a **separate, still-open gate**. A published
`PublishMessage` proves an encrypted ballot was submitted; it does not produce a result.

---

## 2. Topology (get this right before debugging anything)

| Piece            | Where                                          | Notes                                               |
| ---------------- | ---------------------------------------------- | --------------------------------------------------- |
| Browser          | **the user's machine** (MacBook)               | reads/RPC calls originate from HERE, not the server |
| Front-end        | Mini, `:3000`, launchd `ai.venekovox.frontend` | served at `http://app.uxisnear.com:3000`            |
| Backend          | Mini, `:3100`, launchd `ai.venekovox.backend`  | `apps/backend/.env`                                 |
| Local graph-node | Mini, `:18000`                                 | the app's actual read path (`GRAPH_URL`)            |
| Studio subgraph  | hosted                                         | **prize artifact**, not the app's read path         |

**The browser executes on the user's machine.** Every RPC call leaves from their network
and their wallet. A call that answers perfectly from the Mini's shell can still fail in
the browser — this is the single most important fact in this document.

Restart commands:

```sh
launchctl kickstart -k gui/$(id -u)/ai.venekovox.backend
launchctl kickstart -k gui/$(id -u)/ai.venekovox.frontend
```

---

## 3. Failure modes we actually hit (symptom → cause → fix)

### 3.1 The big one: `missing revert data (CALL_EXCEPTION)` on `getPoll(1)`

**Symptom** (appeared for days, survived two wrong fixes):

```
missing revert data (action="call", data=null, reason=null,
  transaction={ "data": "0x1a8cbcaa…0001", "to": "0x44F31f38…" },
  code=CALL_EXCEPTION, version=6.15.0)
```

**Actual cause.** `lib/receiptStatus.ts:168` resolves the poll address with
`MACI.getPoll(pollId)`, and `asReceiptProvider` (useMaci.ts:122) ran that through
`new BrowserProvider(wallet)` — **the wallet's own RPC**. Rainbow's node answers
`{"code":-32005,"message":"Rate Limit Exceeded"}`. Ethers cannot decode a rate-limit
into an ABI revert, so it reports the misleading "missing revert data".

**Why every probe said the chain was healthy.** The identical call answers correctly on
`ethereum-sepolia-rpc.publicnode.com` and `sepolia.gateway.tenderly.co`. All CLI/curl
checks used those. CORS is permissive on both. **The failing call never touched a public
RPC.**

**Fix:** `6a3d3cff2` — `asReceiptProvider(wallet, chainId)` prefers
`makeReadProvider(chainId)` (FallbackProvider over the public RPCs) for
`getTransactionReceipt`, `getTransaction` and `call`, falling back to the wallet only if
every read RPC fails.

**The trap that cost the most time:** the earlier "read provider" fix (`6c2358c2e`)
targeted `publish` → `getPollContracts`, which **does not call `getPoll` at all** — it
reads the `polls()` mapping (selector `0xac2f0074`). Right diagnosis method, wrong
function. Fixes looked verified and left the error byte-identical.

### 3.2 `Eligibility expired. Verify again.`

**Cause:** the grant is capped at **900s** — `SelfEligibilityPolicy.MAX_LIFETIME` is
`15 minutes` (a contract constant) and `apps/backend/src/eligibility/authorization.ts:72`
caps to match. Issued at the scan, consumed at join (`enforce()` writes
`usedIdentityTags` / `usedAccounts`).

**Consequence for demo day:** scan, then join **within ~13 minutes**. A scan from a
previous sitting is always expired. Nothing is consumed on-chain when a grant expires,
so re-scanning is free and repeatable.

**Not fixable without a redeploy** — raising the window means a new policy contract, and
the poll's policy is fixed at poll creation, so it implies a new poll.

### 3.3 `FAILED_TO_GET_DISCLOSURE_CIRCUITS` (historical, resolved)

ZKPassport's mobile `safeGetDisclosureCircuits` wraps **every** error except
`SanctionsFailedError` under this label, and for SALTED it runs `evaluateOPRF(...)`
_before_ circuit selection. The name never meant "gender circuit" or "origin". It was
chased for days as a query-shape problem (gender off, ageBand removed, origin
allowlisted) — all shots at a misread label. The real unblocker was the ZKPassport
dashboard **Allowed origins** list (D18).

**Rule:** when a vendor's error name is a catch-all, stop changing inputs.

### 3.4 Stale client bundle

Editing a workspace package the browser consumes needs the **three-layer** loop:
(1) `pnpm build` the package, (2) purge `apps/front-end/node_modules/.vite`
(`shutil.rmtree` — plain `rm -rf` can be blocked), (3) restart the frontend.
**Then hard-reload (Cmd+Shift+R).** Verify by grepping the _served_ module, never the
file on disk:

```sh
curl -s 'http://localhost:3000/src/hooks/useMaci.ts' | grep -c 'preferRead'
```

Vite inlines `import.meta.env` at server start, so the served module also tells you
exactly what config the browser is running.

---

## 4. The diagnostic channel — use this FIRST

Added because the test machine's devtools are impractical (its F12 key is bound to
volume), so every diagnosis had been inference rather than observation.

| Piece              | Path                                                            |
| ------------------ | --------------------------------------------------------------- |
| Front-end reporter | `apps/front-end/src/lib/clientError.ts`                         |
| Wiring             | `main.tsx` (global handlers) + `useMaci.ts` (vote-flow catch)   |
| Backend route      | `POST /debug/client-error` — `apps/backend/src/routes/debug.ts` |
| Log                | `/tmp/venekovox-client-errors.log` **and** the server log       |

It sends message, code, truncated stack, failing step, page URL, user agent and the
ethers `transaction`/`info` fields. **Never** proofs, query results, signatures, keys or
addresses. The backend scrubs again: `0x` blobs ≥ 200 hex chars and bare 64-char hex are
masked; **short calldata is deliberately kept**, because the failing selector plus its
argument is the highest-value diagnostic here.

```sh
tail -f /tmp/venekovox-client-errors.log
```

**A successful run leaves this file empty.** That is itself evidence.

---

## 5. Diagnostic recipes

### Identify the failing function from the selector

```sh
cast sig "getPoll(uint256)"          # 0x1a8cbcaa
cast sig "polls(uint256)"            # 0xac2f0074
cast sig "publishMessage((uint256[10]),(uint256,uint256))"   # 0x27bea0da
```

Ethers puts the raw 4-byte selector in the tx `data` of a stripped revert. Resolve it
**before reading any code**, then grep the real call sites:

```sh
grep -rn 'getPoll(' packages/sdk/ts/ --include=*.ts | grep -v __tests__
```

### Do NOT infer signer-vs-provider from the error's `transaction` field

Verified by experiment: a call through a plain `JsonRpcProvider` and through
`Wallet.createRandom().connect(provider)` produce **byte-identical** `transaction`
objects. Only a real `JsonRpcSigner` reliably adds `from`.

### Replay the call from the CLI against the endpoint the app uses

```sh
cast call 0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a \
  "getPoll(uint256)(address,address,address)" 1 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

Healthy here + failing in the app ⇒ the bug is in the **delivery pipeline** (stale
bundle, wrong RPC, wallet node), not the contract.

### Verify a vote for real

```sh
cast receipt <txhash> --rpc-url https://ethereum-sepolia-rpc.publicnode.com --json
cast logs --from-block <n> --to-block latest --address 0x517D4260… <PollJoined topic0>
```

### Check the index

```sh
curl -s 'http://localhost:3100/trees/joined-count'
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"query":"{ polls(first:3){ id registrationCount } _meta{ block{number} hasIndexingErrors } }"}' \
  https://api.studio.thegraph.com/query/1758839/venekovox-governance-v-2/wp4-state-leaves
```

---

## 6. Standing environment facts

- **Node 22** for all suites: `PATH=~/Hermes-crypto-builder/p2-toolchain/node22/bin:…`.
  The shell default (v26) breaks the p2 data-URL loader.
- `P2_TOOLCHAIN_PACKAGE_JSON=~/Hermes-crypto-builder/p2-toolchain/zkpassport-scratch/package.json`
  must be exported on **every** p2 run, not just at setup.
- `apps/backend/.env` needs `POLL_ADDRESS` for `/trees/joined-count`; without it the route
  returns `unavailable`.
- Secrets come from the Bitwarden Secrets Manager integration as env vars
  (`ISSUER_PRIVATE_KEY`, `TAG_SECRET`, `GRAPH_STUDIO_DEPLOY_KEY`, Privy creds). Never
  echo them; never commit `.env*`.
- `GRAPH_STUDIO_DEPLOY_KEY` is already stored — a Studio deploy needs no new key from the
  user. `graph-cli` 0.97.1 removed `--studio`; use
  `graph deploy <slug> --node https://api.studio.thegraph.com/deploy/ --version-label <label>`.

---

## 7. Red flags in the repo right now (not blockers, but fix before submission)

1. **User-facing copy names the wrong identity provider.** `Landing.tsx:107` says
   _"Zero-Knowledge Eligibility (Self Protocol)"_, `Landing.tsx:474` links _"Self Protocol
   Docs"_, and `PollDetail.tsx:410` renders a `Self.xyz` badge. The app runs on
   **ZKPassport**.
2. **One landing claim is false post-D18.** The same card says proofs are generated
   _"directly inside your browser"_ — the browser is a **pure relay** (the bb.js Worker
   cannot load); proofs generate on the phone and are verified server-side.
3. **Browser SDK does not disable proof storage.** The server instance does
   (`zkpassportSdk.ts:38`, `{ disableProofStorage: true }`); the browser instance does not
   (`request.ts:43`). Today the `handleResult` override incidentally prevents the proof
   POST, but that should be explicit so it fails closed.
4. `SelfEligibilityPolicy` is **historical naming, not a stale artifact** — it is a
   generic issuer-signed policy with no Self-protocol code, and it is live and
   load-bearing (`guarded()` = poll 1; `configId()` byte-matches the ZKPassport-salted
   backend config). Do not rename it pre-submission; renaming touches the EIP-712 domain
   and salt and forces a redeploy.
