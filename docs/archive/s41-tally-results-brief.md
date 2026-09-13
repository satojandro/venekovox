# S4.1 — Verified tally → results: implementation brief

**Base commit:** `0cad6e493` (main)
**Author:** Hermes (crypto-builder) · **Implementer:** Cursor · **Reviewer/committer:** Hermes
**Gate:** merge only after the tally produces a result that is independently readable
on-chain and cross-checked against a second source.
**Status:** scoped for implementation. One finding below changes the plan — read §2 first.

---

## 0. Objective

Turn a finished poll's encrypted ballots into a **proof-verified result** that the product can
show: the coordinator merges, processes and tallies, the proof-gated results land on-chain, and
the app displays them with provenance (poll, block, verification kind) and honest finality.

Currently the app says _"results will be available after verified counting"_ and there is no
counting. This brief makes that sentence true.

---

## 1. Verified ground truth (do not contradict without evidence)

Everything here was read from the repo or the chain on 2026-09-11.

**The machinery already exists.** This is orchestration + surfacing work, not new cryptography.

| Asset                                          | Where                                               | State                                                  |
| ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Coordinator zkeys (NonQv, matching our depths) | `zkeys/` (3.5 GB, gitignored)                       | ✅ present                                             |
| `merge` task                                   | `packages/contracts/tasks/runner/merge.ts`          | ✅ `pnpm merge:sepolia`                                |
| `prove` task                                   | `packages/contracts/tasks/runner/prove.ts`          | ✅ `pnpm prove:sepolia`, has `--submit-on-chain`       |
| `submitOnChain` task                           | `packages/contracts/tasks/runner/submitOnChain.ts`  | ✅                                                     |
| Zkey wiring + depths                           | `packages/contracts/deploy-config.json` → `sepolia` | ✅                                                     |
| Coordinator REST service (alternative path)    | `apps/coordinator/` (NestJS)                        | ✅ `v1/proof/{generate,merge,submit,publicKey}`        |
| Subgraph vote/governance projection            | `apps/subgraph/schemas/schema.v2.graphql`           | ⚠️ has `TallyStatus`, **no `addTallyResults` handler** |

**Exact circuit configuration of the deployed poll** (from `deploy-config.json`,
corroborated by the deployed zkey filenames):

```
mode                    : 2            (non-QV / 1p1v)
stateTreeDepth          : 10
tallyProcessingStateTreeDepth : 1
voteOptionTreeDepth     : 2            (5^2 = 25 ≥ our 6 options)
messageBatchSize        : 20
messageProcessorZkey    : MessageProcessorNonQv_10-20-2_test
voteTallyZkey           : VoteTallyNonQv_10-1-2_test
```

**Poll 1 (current demo poll):**

```
poll            0x517D42601F3c75DACD2166Af7FC9B8979b0bb709
maci            0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a
signups         1 (stateIndex 1)
numMessages     2
window          1788999251 → 1789600451  (ends 2026-09-16T23:14Z)
```

**What the tally actually is** (do not invent an API):

- `Poll.sol:231` — `if (block.timestamp < endDate) revert VotingPeriodNotOver();`
  **A poll that is still open cannot be merged or tallied.** The `merge` task guards this
  itself at `tasks/runner/merge.ts` via `treeMerger.checkPollDuration()` before merging, so
  the failure surfaces as a task error, not a raw revert.
- `Tally.sol` — `isTallied()`, `getTallyResults(uint256 index) returns (TallyResult)`,
  `addTallyResults(...)`, `tallyVotes(...)`. Results are **per vote-option index**.
- `packages/contracts/tasks/helpers/Prover.ts:162` — hard-fails on
  `"Coordinator public key mismatch."` if the key you pass does not match the poll.

---

## 2. The finding that changes the plan: poll 1 can never be tallied

**Poll 1's coordinator private key is irrecoverable.** The ballots are encrypted to the
coordinator's public key; without the matching private key the two messages cannot be
decrypted, and `Prover.ts` refuses a mismatched key by design.

Verified, not assumed:

| Check                                                                                        | Result                                                                                                               |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Poll's coordinator public key (`deploy-config.json` → `sepolia.Poll.coordinatorPublicKey`)   | `macipk.9a59264310d95cfd8eb7083aebeba221b5c26e77427f12b7c0f50bc1cc35e621`                                            |
| Its hash vs on-chain `coordinatorPublicKeyHash()`                                            | `18398280615350560463991621575078654782282441522280619221439180943869186596052` — **equal** (key identity confirmed) |
| MACI's standard test coordinator key (`macisk.5e20346…`, in `apps/coordinator/.env.example`) | derives to `macipk.0e68d5a1…` → **not the key**                                                                      |
| Any `macisk.` private key in repo / workspace / shell history / Bitwarden                    | **none**                                                                                                             |

The keypair was generated at deploy time and only the **public** half was persisted
(`03-poll.ts:44` reads `coordinatorPublicKey` from config; the private half is a `prove` task
argument and was never stored).

**Consequences:**

1. **S4.1 must run against a NEW poll** with a coordinator keypair we generate and persist.
2. This converges with **WP6 (named-candidates poll)**, which needs a new deploy anyway —
   option labels are poll config and cannot be relabelled on an existing poll.
3. Poll 1's ballot stays encrypted forever. That is an honest and instructive outcome, not a
   failure: it is the privacy property working as designed, and the price of losing one secret.
4. **Key hygiene is now a deliverable, not a nicety.** See WP1.

---

## 3. Scope

**In scope:** generate + persist a coordinator keypair · deploy the demo poll with it · run
merge → process → tally → submit on a finished poll · surface the verified result with
provenance · a runbook · a negative test.

**Out of scope:** demographic slices (Stage 2) · any change to MACI contracts or circuits ·
tally indexing in the subgraph beyond what is needed to read results · distributed/independent
coordinators (Stage 3).

---

## 4. Work packages

Each WP is independently reviewable. ⚠️ marks the highest-risk item.

### WP1 — Coordinator keypair: generate, persist, never lose it again

- Generate a keypair using `apps/coordinator/scripts/generateMaciKeypair.ts`
  (`generateKeypair()` from `@maci-protocol/crypto`).
- Persist the **private** key in Bitwarden Secrets Manager as `VENEKOVOX_COORDINATOR_MACI_KEY`
  (never in the repo, never in shell history). Persist the **public** key in
  `deploy-config.json` → `sepolia.Poll.coordinatorPublicKey`.
- Document the recovery story in the runbook: **who holds it, where, and what breaks without it.**

**Acceptance:** the private key resolves from Bitwarden in a fresh session; the public key in
config hashes to the value the deployed poll reports on-chain.

### WP2 — Deploy the demo poll (with a window that can actually be tallied)

- Deploy via the existing `deploy-poll` task with the named-candidate slate (WP6 options),
  `mode: 2` (non-QV), the WP1 coordinator public key, and the same policy binding.
- ⚠️ **The window must close early enough to tally during the demo.** Options: a short window
  (e.g. ends ~1 h after creation), or run the tally against a local fork. Do not deploy a poll
  that stays open past the submission — it will be untallyable on camera.
- Bind `SelfEligibilityPolicy` exactly as poll 1 does (`setTarget`), and verify `guarded()`.

**Acceptance:** `getPoll(id)` returns the new poll; `guarded()` on the policy equals it;
`voteOptions` matches the slate; the window's end date is in the past by the time the demo runs.

### WP3 — ⚠️ Run the tally: merge → process → tally → submit

Use the existing tasks; do **not** write a new prover.

```
pnpm merge:sepolia      --poll <id>            # merge signups + messages
pnpm prove:sepolia      --poll <id> --coordinator-private-key <from Bitwarden> \
                        --output-dir ./tally --tally-file ./tally.json --submit-on-chain
```

- Requires the poll to be **closed** (§1). Expect `VotingPeriodNotOver` otherwise.
- Record real timings for proof generation — this is the unknown that most affects the demo.
  Rapidsnark (`COORDINATOR_RAPIDSNARK_EXE`) is the escape hatch if snarkjs is too slow.
- `submitOnChain` transactions may need gas-limit tuning; capture the actual gas used.

**Acceptance:** `Tally.isTallied() == true`; `getTallyResults(i)` returns per-option totals for
every option index; the sum reconciles with the number of valid ballots; every tx hash recorded.

### WP4 — Surface the result (this is most of the actual work)

- Backend: a read-only route (e.g. `GET /polls/:id/results`) that reads the tally **from chain**
  and returns `{ tallied, options: [{ index, label, votes }], provenance: { block, tallyAddress } }`.
  Resolve option labels from the poll manifest — **labels are config, not chain data.**
- Frontend: replace the "results available after verified counting" placeholder with the real
  result, and keep three states distinct: **not yet tallied** ≠ **tallied with zero votes** ≠
  **tally unavailable**. `schema.v2.graphql` already encodes this intent
  (`"Null results mean unavailable, not zero"`) — honour it.
- Do **not** show a chart if `isTallied()` is false.

**Acceptance:** with the WP2/WP3 poll, the page renders the real per-option totals matching
`getTallyResults` when read with `cast`, and shows an explicit "not tallied" state on a poll
that has not been tallied.

### WP5 — Negative + honesty tests

- A test asserting the results route refuses to render results for an untallied poll.
- A test that a mismatched coordinator key fails loudly (the `Prover.ts:162` guard) rather than
  producing a wrong tally.
- A test that option labels come from config, so a relabel cannot silently alter the meaning of
  an existing poll's results.

### WP6 — Runbook

Extend `docs/live-test-runbook.md` with a **"Running a tally"** section: prereqs (key from
Bitwarden, poll closed, zkeys present), the exact commands, expected durations, the failure
modes (`VotingPeriodNotOver`, coordinator key mismatch, zkey/depth mismatch), how to verify the
result independently, and the key-recovery statement from WP1.

---

## 5. Risks and unknowns

| #   | Risk                                                                                                              | Mitigation                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Proving time** is the biggest unknown (MessageProcessor batch 20 + VoteTally). Could be minutes or much longer. | Measure on the real poll first; rapidsnark as the fallback; the demo poll is tiny (a handful of ballots) so batching is 1 round. |
| 2   | `submitOnChain` gas / proof size                                                                                  | Capture actual gas; tune limits; keep the poll small.                                                                            |
| 3   | Zkey ↔ poll depth mismatch                                                                                       | Already verified consistent (§1). Re-verify after any redeploy.                                                                  |
| 4   | Tally is read from chain each request                                                                             | Cache by `(poll, tallyAddress, block)`; results are immutable once tallied.                                                      |
| 5   | The eval sees a demo poll that is not poll 1                                                                      | State it plainly in the docs and the video: poll 1's coordinator key was lost; poll 2 is the demo. Honest beats convenient.      |

---

## 6. What Cursor must NOT do

1. **Do not write a new prover or a new tally algorithm.** The hardhat tasks already exist.
2. **Do not modify MACI contracts or circuits.**
3. **Do not put the coordinator private key in the repo, in a config file, in a test fixture,
   or in a command that lands in shell history.** Bitwarden + env only.
4. **Do not invent a results API.** Results are `Tally.getTallyResults(uint256 index)`; labels
   are config.
5. **Do not render a result when `isTallied()` is false**, and never render `0` for "unknown".
6. **Do not attempt to recover or regenerate poll 1's coordinator key.** It is gone; the plan in
   §2 is the plan.

---

## 7. Suggested order

```
WP1 (keypair)  →  WP2 (deploy poll)  →  WP3 (tally)  →  WP4 (surface)  →  WP5 (tests)  →  WP6 (runbook)
                        └────────── WP3 is the unknown; timebox a spike on it early ──────────┘
```

**Recommendation:** before building any of WP4, spend a bounded spike on **WP3 against a tiny
local poll** (hardhat, `PollJoining_10_test`) to measure proving time end-to-end. That single
number decides whether the demo tally is a 5-minute or a 2-hour operation — and everything
downstream is scheduled around it.
