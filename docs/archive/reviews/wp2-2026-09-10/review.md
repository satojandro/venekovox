# WP2 independent review — 2026-09-10

Astra reviewed fetched `origin/main` **f094d1b945e7aade087f9705e559af300d2bc751**.
The working checkout remains `exp/provider-trial-self-vs-zkpassport` at d5b978ac;
new-main source was extracted to `/private/tmp/venekovox-wp2-review` for testing.
Existing design work and dirty documentation were preserved. No deployment, funded
signing, secret inspection, external message, commit or push was performed.

## Conclusion

**The scan failure is unresolved, but the claim that the app is an opaque box is
incorrect. Its public source exposes the error path. Neither an origin problem nor
a failed gender-circuit download is established by this error.**

The known-good trial and product builders produce equivalent decoded requests when
given identical server parameters, using installed SDK 0.16.2. This is locally
reproduced source-level evidence, not a capture of either live session. The actual
server parameters, phone network, cached state and native release still need a
controlled comparison. Alejandro confirms current app **1.3.1**, last failure over
**Wi-Fi**, and no mobile data available while travelling. Phone retry is pending.

## Exact error path found in public mobile source

Reviewed upstream snapshot **c52f5ef1c4c29ce3fd7e46c6dd25d172a1f1cb0e**.
Public source has not been established to be the exact App Store 1.3.1 build;
use this as an implementation lead, not proof of the installed binary's internals.

1. [`DisclosureProofService.safeGetDisclosureCircuits`, lines 420–452](https://github.com/zkpassport/mobile-app/blob/c52f5ef1c4c29ce3fd7e46c6dd25d172a1f1cb0e/src/services/ProofService/DisclosureProofService.ts#L420)
   catches **all** errors from `getDisclosureCircuits` except `SanctionsFailedError`,
   wrapping them as `FAILED_TO_GET_DISCLOSURE_CIRCUITS`. The original exception is
   retained in `error_details` at that boundary. This label does not identify the
   failing subsystem.
2. [`getDisclosureCircuits`, lines 948–962](https://github.com/zkpassport/mobile-app/blob/c52f5ef1c4c29ce3fd7e46c6dd25d172a1f1cb0e/src/lib/circuit-matcher.ts#L948)
   performs **`evaluateOPRF(...)` before its circuit-selection loop for SALTED**.
   This is an authenticated network round trip needed for salted identity. An
   OPRF network/auth/protocol failure can therefore produce precisely this label.
   Timing markers `OprfServerRequestStart` / `OprfServerRequestComplete` surround it.
3. The same function prepares age/nationality circuits and FaceMatch inputs. Missing
   artifacts, input construction failures, and missing/invalid FaceMatch attestation
   are also candidates. See [FaceMatch preparation, lines 1255–1285](https://github.com/zkpassport/mobile-app/blob/c52f5ef1c4c29ce3fd7e46c6dd25d172a1f1cb0e/src/lib/circuit-matcher.ts#L1255).
4. [`ErrorContext`, lines 219–236](https://github.com/zkpassport/mobile-app/blob/c52f5ef1c4c29ce3fd7e46c6dd25d172a1f1cb0e/src/context/ErrorContext.tsx#L219)
   automatically retries a first circuit error. Bouncing progress is consistent
   with this retry; it does **not** prove repeated artifact downloads. Heat alone
   does not identify the cause.

The next useful datum is the **sanitized inner error category and last completed
stage**, not another change to gender, nationality, scope or uniqueness. Do not
paste raw mobile diagnostics: reporting code can include document/device metadata.
If maintainer assistance is needed, ask them to inspect the inner exception and
OPRF timing, sharing only the approved minimal error/version/time summary.

## What the client comparison rules out locally

`request-parity.cjs` executes the actual product `request.ts` and trial HTML builder
against the installed SDK. Only bridge creation and dashboard fetch are replaced
with synthetic local fixtures; real request initialization, builder methods,
country normalization, enum handling and URL serialization execute.

Three tests passed:

- Product/trial parity for the current AU + age 18 + strict FaceMatch request.
- Product/trial parity with gender disclosure added, matching the D10 query style.
- `.range("age",18,29)` yields `{age:{range:[18,29]}}` with no birthdate disclosure.

Decoded parameters agree: `d=uxisnear.com`, `v=0.16.2`, `m=fast`, `dev=0`, `nt=1`,
`dt=now-604800`, service scope `venekovox-stage1`, nationality `AUS`. Both clients
explicitly construct `new ZKPassport(params.domain)`. Neither automatically
substitutes the browser hostname. They do not apply `.policy()`; merely having a
published dashboard policy does not apply it to these builders. The SDK fetches
project metadata, which is fixture-controlled in this test.

This does not establish the runtime Mini environment, dashboard responses, browser
bundle freshness, live QR contents, or the exact historical D10 request.
The phone error occurs before a proof is delivered for backend verification, so
`policy.enforce`, grant signing and poll deployment cannot repair that phone stage.

## Public service check

Installed `@zkpassport/utils@0.37.5` uses three default OPRF services with threshold
2, key ID `1`, module `face-match`, protocol `0.9.0`:

- `https://eu.node0.zkp.oprf.taceo.network`
- `https://eu.node1.zkp.oprf.taceo.network`
- `https://eu.node2.zkp.oprf.taceo.network`

On September 10 all three `GET /oprf_pub/1` calls succeeded from this laptop and
returned the same public key (matching the SDK default), epoch 4. No proofs or
identity data were sent. This rules out a total public-key endpoint outage from
this laptop at that time. It does **not** test authenticated OPRF evaluation,
WebSocket reachability from the phone, historical availability or mobile dependency
versions. OPRF remains a concrete suspect, not a demonstrated root cause.

## Corrections and separate integration findings

1. **Age-range support was incorrectly removed on a factual premise.** SDK 0.16.2
   supports `range`, and the [mobile selector explicitly handles age `range`](https://github.com/zkpassport/mobile-app/blob/c52f5ef1c4c29ce3fd7e46c6dd25d172a1f1cb0e/src/lib/circuit-matcher.ts#L1047)
   using `compare_age`. The dashboard chip vocabulary is not the SDK capability
   boundary. A specific range membership can be proved without revealing birthdate;
   this does not itself implement automatic demographic bucketing. Comments/tests
   claiming birthdate disclosure is the *only* age-band mechanism should be corrected.
   There is no reason to request birthdate to debug this Stage-1 scan. Stage-1's
   minimum-age-only choice can remain.
2. **One disclosure field is not necessarily one separate circuit.** The mobile
   selector coalesces eligible fields into `disclose_bytes` and handles age/country
   predicates within the broader disclosure phase. Existing comments about one
   extra circuit per REVEAL overstate the evidence.
3. **Live mode does not itself disable mock acceptance.** At reviewed main's
   `apps/backend/src/eligibility/product.ts:83`, `devMode: !env.ZKP_LIVE_REQUIRED`
   is independent of `ZKP_MODE`. A live signer with that variable absent permits
   mock mode; any nonempty string (even `"false"`) disables it. Health's `mode:live`
   alone does not prove live passport enforcement. Pin live configuration to
   `devMode:false`, reject contradictory settings and add a live-factory negative
   test before operational use. Do not use the handoff's suggestion of unsetting
   this flag on the deployed-policy signer as a diagnostic; isolate mock tests
   with synthetic issuer/target instead. Current remote env was not inspected.
4. **Trial birthdate opt-in is incomplete.** Latest trialServer can emit
   `discloseBirthdate`, but trialClient still only consumes gender/age/nationality/
   FaceMatch hints. Enabling `TRIAL_ZKP_DISCLOSE_BIRTHDATE` causes a server/client
   query mismatch. It is off for the reported session and cannot explain the
   current pre-proof phone error.
5. **Five-minute challenge versus slow phone proving.** `authorization.ts:133`
   starts a 300-second expiry before scanning. `Auth.tsx` has no expiry countdown,
   lifecycle cancellation or fresh-session recovery while displaying a QR. Long
   proof generation/retries can next hit `CHALLENGE_EXPIRED_OR_MISSING`, even if
   the phone issue resolves. The seven-day proof validity is a different clock.
   This is a separate UX/recovery issue; silently accepting expired challenges
   would be the wrong fix.

No production change was made from these hypotheses. Keep the D17 domain, scope,
salted uniqueness and strict FaceMatch stable while isolating the actual failure.

## Next controlled session

1. On the Mini, generate a **fresh** trial QR and a fresh product QR with identical
   pinned parameters, same allowed page host, app 1.3.1 and the same phone/network.
   Inspect locally the decoded query and `d,v,m,dev,nt,dt,oprf_k` plus service scope.
   Do not post whole QRs/bridge topics, account signatures or proof payloads.
2. Run trial first. If it now fails with the same label, the React product mount
   is not required to reproduce the failure. Compare network/OPRF/native state.
   If trial passes but product fails, compare actual returned begin parameters
   and loaded bundle versions against the tested source; do not assume defaults.
3. When available, repeat the failing request on another trusted network (or mobile
   data) with no other changes. There is no pending request to retry while travelling.
4. If the label persists, obtain the sanitized inner exception/stage via the
   provider's supported diagnostics or a developer build. Start-without-complete
   OPRF timing directs investigation to that service/authentication path; successful
   OPRF completion directs it to circuit/input/FaceMatch preparation.
5. After a genuine server-verified grant, continue the separate join/vote smoke.
   Successful QR generation, synthetic proofs and fork tests do not close that gate.

## Reproduction and evidence

From repository root, create a clean source snapshot without changing this checkout:

```sh
mkdir -p /private/tmp/venekovox-wp2-review
git archive f094d1b945e7aade087f9705e559af300d2bc751 | tar -x -C /private/tmp/venekovox-wp2-review
WP2_REVIEW_ROOT=/private/tmp/venekovox-wp2-review \
P2_TOOLCHAIN_PACKAGE_JSON=/Users/avb/venekovox/apps/front-end/package.json \
/Users/avb/Hermes-crypto-builder/p2-toolchain/node22/bin/node \
  --test docs/reviews/wp2-2026-09-10/request-parity.cjs
```

Result: **3/3 passed**. Toolchain Node **22.20.0**.

From the extracted snapshot:

```sh
P2_TOOLCHAIN_PACKAGE_JSON=/Users/avb/Hermes-crypto-builder/p2-toolchain/zkpassport-scratch/package.json \
/Users/avb/Hermes-crypto-builder/p2-toolchain/node22/bin/node \
  --test apps/backend/tests/p2/*.test.mjs
```

Result: **64/64 passed**. Initial sandbox run had 11 localhost-listen EPERM failures;
rerun with authorized localhost access passed. No native phone test, live proof,
production environment audit, full frontend build, deployment or chain read-back
was performed in this review. Upstream files are source-reviewed, not native-built.
