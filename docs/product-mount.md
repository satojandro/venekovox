# C — Product mount: ZKPassport → app.ts + FE Auth → join gate bytes

**Base commit:** `exp/provider-trial-self-vs-zkpassport` tip (currently `9a9add3e4`)
**Owner spec:** Hermes for Cursor · **Reviewer/committer:** Hermes
**Gate:** merge to `main` only after this mount PR is reviewed (architect's C gate).

## 0. Objective

Move the ZKPassport eligibility path from the separate trial server into the
product backend (`app.ts`) and replace the legacy Self-pass FE Auth flow so a
real EIP-712 **gate evidence** reaches the on-chain join (`Poll.sol:388
policy.enforce(msg.sender, _signUpPolicyData)`). Keep the D17 salted lock; never
browser-verify proofs; never store raw proofs/query results.

## 1. Verified ground truth (Hermes, 2026-09-09 — do not contradict without evidence)

- `apps/backend/src/app.ts` mounts ONLY `/verify` (legacy Self Pass,
  `routes/verify.ts`, explicitly marked legacy) and `/polls`. **No eligibility
  routes.**
- The complete ZKPassport path exists and is D10-PROVEN in:
  - `apps/backend/src/eligibility/authorization.ts` — challenge, HMAC
    identityTag (line ~185), EIP-712 Authorization, `EligibilityService`
  - `apps/backend/src/eligibility/accountControl.ts` — EOA/ERC-1271
  - `apps/backend/src/eligibility/zkpassport.ts` — `ZkPassportEligibility`
    (begin-gate, canonical query deep-equal, expiry recheck, uniqueness-type
    reject, minimal claims)
  - `apps/backend/src/eligibility/zkpassportSdk.mts` — transport incl.
    `tagNullifierType()` (numeric enum → string)
  - `packages/contracts/contracts/eligibility/SelfEligibilityPolicy.sol` —
    `usedIdentityTags`/`usedAccounts`/`AlreadyEnforced`
  - EVM suite `packages/contracts/test-p2/eligibility.evm.test.mjs` (9/9)
  - Backend tests `apps/backend/tests/p2/zkpassport.test.mjs` (50/50 incl. D17)
- The working mounted pattern exists in `apps/backend/src/trialServer.ts`
  (routes + service wiring + live-mode env gates) and in
  `apps/backend/src/trialClient.html` (the ONLY browser client that has run a
  real passport end-to-end).
- Frontend: `apps/front-end/src/pages/Auth.tsx` at `/trust-ritual` uses legacy
  `@selfxyz/qrcode` and writes `localStorage.venekovox_verified="true"` (fake).
  Join/signup lives in `apps/front-end/src/hooks/useMaci.ts` (MACI SDK browser,
  Keypair). `Poll.sol:388` consumes `_signUpPolicyData` via `policy.enforce`.
- D10 (D18) proved the real gate: verified ZKPassport project domain + allowed
  origin requirement; `request()` is async; deep-link `uniqueIdentifierType`
  must be the numeric enum (SALTED=1); browser-side `verify()` MUST be skipped
  (override `zk.handleResult`) because esm.sh cannot serve the `@aztec/bb.js`
  Worker asset (404 + cross-origin Worker block).

## 2. Backend mount

Create `apps/backend/src/routes/eligibility.ts` (Express Router) wired in
`app.ts`:

```
POST /eligibility/challenge  { account }                    → challengeId, message, expiresAt
POST /eligibility/begin      { challengeId, signature }      → domain, scope, validity, devMode,
                                                               uniqueIdentifierType, oprfKeyId?, query, queryBuild
POST /eligibility/receive    { challengeId, signature,
                               payload{ proofs, originalQuery, queryResult } } → outcome
POST /eligibility/authorize  { challengeId, signature }      → { authorization, signature, evidence }
GET  /eligibility/health                                     → { ok, mode, provider: "zkpassport" }
```

Requirements:

- Reuse `ZkPassportEligibility` + `zkpassportTransport` + the shared
  `authorization.ts`/`accountControl.ts` boundary unchanged. Do NOT fork them
  per-provider (D17: provider-agnostic boundary).
- Configuration from env, `ZKP_*` (not `TRIAL_*`): `ZKP_DOMAIN` (default
  `uxisnear.com` for demo), `ZKP_SCOPE` (`venekovox-stage1`),
  `ZKP_CONFIG_ID` (`venekovox-stage1-salted-v1`), `ZKP_LIVE_REQUIRED`,
  `ZKP_OPRF_KEY_ID?`, `ISSUER_PRIVATE_KEY` (live), `TAG_SECRET` (live, hex,
  ≥32 bytes), `POLICY_ADDRESS`, `TARGET_ADDRESS` (live; test mode throwaway
  random addresses, NEVER ZeroAddress — accountAddress() rejects it),
  `CHAIN_ID` (11155111). Live mode must fail fast with a clear error if
  issuer/tag not set (mirror `trialServer.ts`).
- Session store: introduce a minimal `SessionStore` interface with an
  in-memory Map implementation as default; mark durable/transactional storage
  (Redis/SQLite) as an explicit release gate (G01) — do NOT claim durability.
  Keep challenge expiry (300s), capacity cap, `busy` semantics.
- Rate-limit `challenge`/`begin` (e.g. 20/min/IP, express-rate-limit); keep
  helmet + JSON body limit.
- CORS: add the FE origin(s) to `app.ts` CORS allowlist (keep existing entries;
  add `http://localhost:5173` already there and the deployed FE origin, plus
  the ZKPassport served origin if FE and API are same-origin in prod).
- Keep legacy `/verify` mounted but untouched (migration debt, per D02/D17
  docs) — new eligibility must not reuse it.

## 3. Frontend Auth replacement (`Auth.tsx` /trust-ritual)

Replace the `@selfxyz/qrcode` flow with the ZKPassport client flow, mirroring
`trialClient.html` exactly (that file has the verified fixes):

1. Connect wallet (injected EIP-1193).
2. `POST /eligibility/challenge` → sign `message` with the wallet.
3. `POST /eligibility/begin` → use server-pinned params.
4. Build the SDK request with `import { ZKPassport, NullifierType } from
"@zkpassport/sdk"` (npm dep, add to `apps/front-end/package.json` +
   lockfile via `pnpm install --lockfile-only`):
   - `await zk.request({ ... uniqueIdentifierType: params.uniqueIdentifierType
=== "SALTED" ? NullifierType.SALTED : NullifierType.NON_SALTED, ... })`
     — **`await` is mandatory** (request() is async).
   - Chain builder from `params.queryBuild` (`disclose/gte/range/in/facematch`).
5. Show QR (use a QR lib in FE or the deep-link; do NOT depend on
   api.qrserver.com in product).
6. **Override `zk.handleResult`** to capture `topicToProofs`/`topicToResults`
   and relay to `POST /eligibility/receive` — never call the SDK's browser
   `verify()`/`onResult` path (bb.js Worker cannot load via CDN/bundler; the
   server is the authoritative verifier).
7. `POST /eligibility/authorize` → store the resulting **gate evidence**
   (authorization + signature) where the join flow can read it.
8. Never store raw proofs/queryResult; store only the evidence + status.

FE storage/state:

- Remove the fake `venekovox_verified=true` boolean. Introduce a typed
  eligibility state (e.g. `venue: "zkpassport"` + `evidence` + `account` +
  `issuedAt/expiresAt`). Storing evidence in localStorage is acceptable for the
  demo ONLY if clearly bounded (no proofs) and documented as a durability
  gap; prefer sessionStorage + explicit join-time fetch if easier.
- `useMaci.ts` (or a new `useEligibility.ts`) must PLUMB the evidence bytes
  into the MACI signup/join call so `_signUpPolicyData` is the real
  `evidence` string (see §4).

## 4. Join bytes (the actual gate)

`Poll.sol:388` requires `_signUpPolicyData` == encoded
`Authorization + signature` that `SelfEligibilityPolicy.enforce` accepts
(`encodeAuthorization` in `authorization.ts`). In the MACI SDK join/signup
call, pass the evidence string as signUpPolicyData:

- Find the MACI SDK join-call surface used by `useMaci.ts` (signup or
  joinPoll) and confirm the parameter name (`_signUpPolicyData` /
  `signUpPolicyData`). If the SDK exposes it, pass the evidence; if not,
  extend/translate at the call site.
- Policy/target addresses for join must match the mounted service config
  (POLICY_ADDRESS/TARGET_ADDRESS); after WP0 deploys the real policy, wire
  those addresses from deployment output — for now use the staged values and
  mark clearly.
- **Dry-run before any signature:** `eth_call` the join from the signing
  address with the real evidence BEFORE requesting the user sign; report
  pass/fail table. See herm-notes: never ask for a signature on an unproven tx.

## 5. Hard constraints (D17/D18 — violations are merge blockers)

- Salted uniqueness + `facematch("strict")` REQUIRED (adapter enforces at
  construction). Never silently flip to scoped (PM decision + record only).
- `uniqueIdentifierType` pinned in `configId`; salted↔scoped mix rejected at
  verify. No raw `uniqueIdentifier` beyond the HMAC tag in calldata.
- ZKPassport project **allowed origins** must contain the page's serving origin
  (dashboard verified `app.uxisnear.com`; production vendor domain
  `venekovox.com`/subdomain must be verified there too, with DNS TXT
  `_zkpassport` = `zkpassport-verify=<host>` and source of truth preserved).
- No raw proofs/queryResult in logs, storage, or responses; status codes only.
- `zk.request()` await; numeric `NullifierType`; browser-verify bypass —
  non-negotiable (proven in D10).

## 6. Acceptance

Backend:

- `pnpm --dir apps/backend test:p2` (≥50) + `typecheck:p2` clean
- `pnpm --dir apps/backend build` clean; boot `app.ts`, curl every
  /eligibility route; verify mounted alongside legacy /verify
- Negative suite against the MOUNTED router (not just trialServer): wrong
  account, no-begin, expiry during verify, query mismatch, salted rejects
  NON_SALTED, `SALTED_MOCK` outside dev, empty/non-canonical identifier,
  client-trusted proof rejected (transport always called)
- Rate-limit fires; CORS allows FE origin
- EVM suite still 9/9 (contract untouched)

Frontend:

- `pnpm --dir apps/front-end build` + `test:unit` green
- `/trust-ritual` renders ZKPassport flow (no Self QR), statuses:
  unverified → QR → relayed/server-verifying → authorized (evidence shown),
  error states incl. rejection/expired
- No `venekovox_verified` boolean remains in code
- Evidence bytes flow into the join call and `eth_call` dry-run passes against
  the staged policy config before any signature

## 7. Integration checklist for Hermes (returned with the patch)

- Base commit actually at mount point; `git apply --check` clean if patch
- Diff stat + new file list (no unrelated changes)
- Test output pasted (backend+p2, EVM, FE) — Hermes re-runs independently
- Evidence of live curl of mounted routes (or explicit "could not run")
- State exactly which SDK param carries signUpPolicyData and where
- Known gaps (durable storage, WP0 real policy, FE session hygiene) listed

## 8. Explicit non-goals (this PR)

- No durable store (release gate, G01)
- No WP0 poll deploy (separate gate)
- No live tally UI, no comment features
- No Enterprise mounting (D17 leaves it unmounted)
- No TLSNotary/vLayer, no x402/Bazantic wiring
