# Your wallet's RPC is not a read endpoint

_September 2026 — VenekoVox build note. A three-day bug, a lying error message, and the
diagnostic habit that finally cracked it._

---

## The one-line summary

A MACI poll vote failed with `missing revert data (CALL_EXCEPTION)` against a contract
that was provably healthy. The contract was fine. The **wallet's RPC was rate-limiting a
read** — and ethers reported that rate limit as a reverted contract call.

We found it by instrumenting the browser instead of guessing at it. The fix is two lines.
The lesson is architectural.

---

## 1. The symptom, and why it sent us the wrong way

Every attempt to vote ended with this:

```
missing revert data (action="call", data=null, reason=null,
  transaction={ "data": "0x1a8cbcaa…0001", "to": "0x44F31f38…" },
  invocation=null, revert=null, code=CALL_EXCEPTION, version=6.15.0)
```

Read that naively and you conclude: _the contract reverted_. So we went to the contract.
We checked the poll existed, checked the state root, checked the policy binding, checked
the ABI. All healthy. We replayed the exact call from the CLI:

```sh
cast call 0x44F31f38… "getPoll(uint256)(address,address,address)" 1 --rpc-url <public-rpc>
# → 0x517D4260…, 0x93cE1831…, 0xaf799426…   ← perfectly fine
```

The chain answered. The app didn't. That gap is the whole story, and we spent days
standing in it.

---

## 2. What was actually happening

The failing call was in our own receipt verifier:

```ts
// apps/front-end/src/lib/receiptStatus.ts
const data = await args.provider.call(args.maciAddress, encodeGetPollCall(args.pollId));
```

and the provider handed to it was this:

```ts
// apps/front-end/src/hooks/useMaci.ts  (before the fix)
function asReceiptProvider(wallet: WalletProvider): ReceiptProvider {
  const provider = new BrowserProvider(wallet); // ← the WALLET's RPC
  return {
    async call(to, data) {
      return provider.call({ to, data }); // ← a "read" through the wallet
    },
    // …
  };
}
```

`new BrowserProvider(window.ethereum)` is a **Provider**, not a Signer. Using it for a
plain `eth_call` looks exactly like a normal public-RPC read — same shape, same code, no
`from` field — but it routes through the wallet's own node. Rainbow's built-in Sepolia
node answered:

```json
{ "error": { "code": -32005, "message": "Rate Limit Exceeded" } }
```

That is not a revert. It is an RPC-level throttle. Ethers could not map it onto an ABI
revert, so it classified it under the nearest available bucket: `CALL_EXCEPTION`, message
`missing revert data`.

---

## 3. Finding #1: the error class lied, but the truth was in the payload

This is the part worth internalising. Ethers v6 did **not** lose the information — it
stashed it in `error.info`:

```json
"info": {
  "error":   {"code": -32005, "message": "Rate Limit Exceeded"},
  "payload": {"method": "eth_call",
              "params": [{"to": "0x44f31f38…",
                          "data": "0x1a8cbcaa…0001"}, "latest"]}
}
```

and the stack named the layer outright:

```
at _AbiCoder.getBuiltinCallException   (ethers.js:12137)
at _BrowserProvider.getRpcError        (ethers.js:19358)   ← the wallet's provider
```

Two habits fall out of this:

- **`code === "CALL_EXCEPTION"` does not mean "the contract reverted."** Before believing
  it, read `error.info.error` — the raw JSON-RPC error — and the stack, which names the
  provider class that raised it.
- **A `-32005` never reaches the contract.** If you see it, you are debugging transport,
  not solidity.

---

## 4. Finding #2: "healthy from the CLI" proves nothing

We had run the identical call, successfully, many times:

| Endpoint                              | `getPoll(1)` |
| ------------------------------------- | ------------ |
| `ethereum-sepolia-rpc.publicnode.com` | ✅           |
| `sepolia.gateway.tenderly.co`         | ✅           |
| **the wallet's injected provider**    | ❌ `-32005`  |

CORS was permissive on both public endpoints. The contract was fine. **The failing call
never touched a public RPC** — and no CLI probe ever exercised the endpoint the browser
actually used.

> **Rule.** "Healthy from the CLI" is evidence about _the endpoint you chose_. It is not
> evidence about the endpoint the failing code chose. Compare the endpoint in the real
> error's `info.payload` against the one your probe used. If they differ, you have been
> testing a path the app never took.

This is why the bug survived two "fixes": we were diagnosing a path that worked.

---

## 5. Finding #3: an API that takes only a `signer` steers integrators into this

The MACI SDK's read helpers mostly take a **single** `signer` and derive the provider from
it:

```ts
getJoinedUserData({ maciAddress, pollId, pollPublicKey, signer, startBlock });
hasUserJoinedPoll({ maciAddress, pollId, nullifier, signer });
```

Some functions accept an optional `provider` — `getPollContracts`, `poll/poll.ts`,
`relayer/messages.ts` — but a majority of internal call sites pass **only** a `signer`:

```
packages/sdk/ts/tally/results.ts:16,32,57     signer
packages/sdk/ts/vote/invalidate.ts:28         signer
packages/sdk/ts/proof/prove.ts:37             signer
packages/sdk/ts/maci/merge.ts:13              signer
packages/sdk/ts/poll/poll.ts:19               signer, provider   ← the exception
packages/sdk/ts/relayer/messages.ts:30,94     signer, provider   ← the exception
```

That asymmetry is a design smell, not a bug. `signer` conflates two different roles:

- **who authorises this call** (the account; needs a signature)
- **which endpoint serves this read** (infrastructure; needs to be reliable and cheap)

When one parameter carries both, the natural integration — "here's my signer" — silently
routes every read through whatever RPC that wallet happens to ship with. That is fine for
occasional reads and fragile the moment the wallet's node throttles.

The symptom is `getPoll` reverting intermittently. The cause is an endpoint choice nobody
made deliberately.

---

## 6. The fix

Thread the read endpoint explicitly, and prefer it for everything that does not sign:

```ts
function asReceiptProvider(wallet: WalletProvider, chainId: bigint): ReceiptProvider {
  const walletProvider = new BrowserProvider(wallet);
  const readProvider = makeReadProvider(chainId); // FallbackProvider, public RPCs

  async function preferRead<T>(
    viaRead: (p: FallbackProvider) => Promise<T>,
    viaWallet: (p: BrowserProvider) => Promise<T>,
  ): Promise<T> {
    try {
      return await viaRead(readProvider);
    } catch {
      return viaWallet(walletProvider);
    } // only if every read RPC failed
  }

  return {
    async call(to, data) {
      return preferRead(
        (p) => p.call({ to, data }),
        (p) => p.call({ to, data }),
      );
    },
    // getTransactionReceipt / getTransaction likewise
  };
}
```

The wallet signs. The read provider reads. One rule: **no read ever rides the signer's
provider.**

The same rule has to be applied everywhere, because it is rarely just one call site:

```sh
grep -rn 'signer\.provider' packages/sdk/ts/ apps/*/src/ | grep -v __tests__
grep -rn 'BrowserProvider(' apps/front-end/src/
```

---

## 7. How we actually found it (the part that mattered)

Everything above was discoverable. It stayed hidden because our observation loop was
broken: the failing code ran in **the user's browser**, and the developer's instinct was
to ask for the console. The test machine's `F12` key was bound to volume — devtools were
practically unreachable.

So we stopped asking and built the observation channel:

- **Backend:** `POST /debug/client-error` → one JSON line to a log file _and_ the server
  log.
- **Front-end:** a `reportClientError(error, step)` helper wired into the failing flow's
  `catch` **and** into `window.onerror` / `unhandledrejection` — a caught error still gets
  reported, which a global handler alone would miss.
- **Server-side scrubbing**, shaped around the diagnostic we wanted: mask proof-sized
  blobs (`0x` + ≥200 hex chars) and bare 64-char hex, but **keep short calldata** — the
  failing selector plus its single argument _is_ the answer.
- **Fire-and-forget:** `fetch(...).catch(() => {})`. Instrumentation must never be able to
  break the thing under test.

It cost about thirty minutes. The **first** retry after it shipped produced the root cause
objectively, in one line of JSON:

```
"error": {"code": -32005, "message": "Rate Limit Exceeded"}
```

after two days of inference. Two errors were captured; both were root-caused the same
hour.

> If you cannot see the client, instrument it so the failure arrives where you already
> are. And treat an **empty** log as a result: no entry means the error was swallowed
> before the instrumented path, which points somewhere else entirely.

---

## 8. The one diagnostic you should run first

Ethers puts the raw 4-byte selector in the `data` of a stripped revert. Resolve it before
reading a line of code:

```sh
cast sig "getPoll(uint256)"     # 0x1a8cbcaa
cast sig "polls(uint256)"       # 0xac2f0074
```

We had assumed `0x1a8cbcaa` belonged to `getPollContracts`. It does not — `getPollContracts`
reads the `polls(id)` mapping (`0xac2f0074`) and `nextPollId()`. So an earlier "read
provider fix" was applied to a function that never made the failing call. It passed its
tests, shipped, and left the user's error **byte-identical**.

> Resolve the selector → `grep` the real symbol's call sites → only then fix. A fix aimed
> at the wrong function is indistinguishable from a good fix in every test you can write.

---

## 9. Honest limits

- **The two-line fix is not novel.** Routing reads through a dedicated public provider is
  standard practice. What generalised here was the _diagnosis_: selector-first
  identification, reading `error.info` instead of trusting `error.code`, enumerating every
  endpoint the failing path can reach, and instrumenting the client. Nothing in this post
  is a new technique.
- **The bug was ours, not MACI's.** The failing line was application code. The upstream
  observation in §5 is a critique of an API _shape_ that makes this easy to build — not a
  defect report, and not a claim about the protocol. MACI itself worked correctly
  throughout; the vote that followed the fix is on Sepolia.
- **`-32005` is not always the cause.** It is one throttle among several ways a wallet node
  can fail a read. The transferable rule is "check which endpoint served the call", not
  "look for -32005".
- **The rate limit is intermittent.** It is a free-tier node under load. Any single
  reproduction attempt — ours included — may succeed and appear to exonerate the RPC. Use
  the payload from a real failure, not a probe.
- **Reads still need retries.** A dedicated read provider narrows the problem; it does not
  eliminate it. We added backoff and a multi-endpoint fallback.

---

## 10. Takeaways

1. `code: CALL_EXCEPTION` + `missing revert data` is not proof of a contract revert. Read
   `error.info.error` and the stack.
2. Never infer which layer failed from the absence of a `from` field — a throwaway wallet
   on a read provider and a plain provider produce **byte-identical** error objects. We
   verified this by experiment.
3. "Healthy from the CLI" is evidence about your endpoint, not the app's.
4. A wallet is a signer. It is not infrastructure. Do not read through it.
5. If a vendor error name is a catch-all — as ZKPassport's
   `FAILED_TO_GET_DISCLOSURE_CIRCUITS` also proved to be — stop varying inputs and go find
   the real error.
6. When you cannot see the client, ship the observation channel. It is one commit, and it
   ends the guessing.
