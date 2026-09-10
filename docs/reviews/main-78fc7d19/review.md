# Quick main and branch review — 2026-09-10

Scope: S2.1/S3 follow-up, read-only code/branch review of fetched main
`78fc7d1979317edd9d76049042cd4735464ec694`. No subgraph implementation,
merge, branch deletion, reset, funded action or live transaction verification.
Checkout was clean at `1fe7f22f` on `exp/provider-trial-self-vs-zkpassport`.

## Repair status (same day)

Branch `fix/main-78fc-grant-retry-tests` addresses the three P1/test items below
(grant cap, join retry boundary, voteFlow loader). Signup CALL_EXCEPTION
fail-open and read-provider chain identity remain open. Evidence: docs/status.md.

## Findings before the next implementation

- **P1: Default grants cannot pass the policy.** `authorization.ts` now defaults
  to 3,600 seconds while `SelfEligibilityPolicy.sol:28,105–108` caps lifetime at
  900 seconds. Default grants revert `InvalidLifetime`, independent of subgraph
  performance. Validate a positive integer duration <= the target policy cap;
  issue a fresh grant near join. Long scans still encounter the separate 300s
  challenge expiry. This is source-verified; deployed policy was not re-read.
- **P1: Retry includes a transaction.** `voteFlow.ts` wraps the entire browser
  `joinPoll` in `withRpcRetry`; that SDK function sends, waits, then queries logs.
  A retryable error after submission can re-enter join with stale membership
  information or report failure after success. Separate read/proof preparation
  retries from submission and reconcile the transaction hash after submission.
  The comment claiming all wrapped failures precede signatures is incorrect.
- **P2: Registration errors fail open to “not registered.”**
  `packages/sdk/ts/user/signup.ts` maps every `CALL_EXCEPTION` to absent signup.
  The same patch describes transient empty-data RPC failures, so this error class
  cannot establish absent membership. Match the actual custom-error selector;
  retry or surface ambiguous errors before requesting signup.
- **P2: New read providers trust configured chain identity.** `readProvider.ts`
  and participation hydration pass `staticNetwork:true`; they do not establish
  the endpoint's actual chain. Verify chain identity and dispose/reuse providers.
  Some reads still use the wallet provider (`contractExists`, first signup-block
  lookup and receipt-event query), despite “all reads” comments.
- **Reproduced test regression:** latest `tests/voteFlow.test.mjs` fails to load
  on Node 22.20.0: `ERR_UNSUPPORTED_RESOLVE_REQUEST` for new `ethers` import from
  the data-URL module. Relative readProvider import/import.meta.env also needs
  harness adaptation or dependency injection. The frontend vote-flow tests are
  not currently green. Latest commit adds no tests for the six infrastructure fixes.

Latest commit reports backend/frontend typechecks, p2 64/64 and a signup receipt
abbreviated as `0x99686f82…`, state index 1. These are **Hermes-reported** here;
no join/vote success is established. Canonical status/journey/continuity docs were
not updated by this runtime commit and still carry the earlier scan diagnosis.

## Subgraph boundary for the separate session

The SDK scans block windows, not batches of voters: `generateSignUpTree` defaults
`blocksPerRequest=50` and uses inclusive 51-block ranges. Cost grows with scanned
chain history even with few signups. The new chunk backoff is in
`parsePollJoinEvents` (membership lookup), not the actual signup-tree scan.

An indexed event source can remove repeated historical RPC log retrieval. Merely
replacing logs with GraphQL still leaves per-client tree construction. The existing
browser `joinPoll` accepts `inclusionProof`: a validated proof/snapshot service is
another possible boundary to evaluate in the brief. Verify completeness, event
order, indexing lag/reorgs and the exact on-chain root/index before trusting an
indexed witness. No architecture decision is implemented by this review.

## Branch inventory relative to origin/main

Counts are commits unique to main / unique to branch, after fetch:

| Branch | Behind / unique | Recommendation |
|---|---:|---|
| Current `exp/provider-trial-self-vs-zkpassport` | 18 / 1 | Port `1fe7f22f` Audit (review + design assets + docs), then retire trial branch |
| Local `main` | 27 / 4 | Preserve under a named archive/integration branch before any reset or replacement |
| `origin/codex/ens-registration-v2` | 35 / 4 | Preserve ENS feature + later handoff docs; deliberate integration required |
| `origin/w1-privy-experiment` | 50 / 5 | Preserve; commits are not ancestors or patch-equivalent according to git cherry |
| `origin/fix/wp2-review-comment-corrections` | 1 / 0 | Fully merged, eligible for cleanup |
| `origin/s5-governance` | 42 / 0 | Already merged; do not re-merge for subgraph work |

Also fully contained in main: both Cursor fix branches, p1 receipt verification,
ENS poll-discovery, p2 Enterprise, old MACI/Self and main docs baseline branches.
Remote deletion should follow an agreed cleanup, not this review alone. Keep any
external PR/demo references in mind before retiring historical remote names.

Local main's four unique commits include `3fd87a2e` ENSv2, `0aa52eb1` participant/
admin journey UI and two integration merges (`10688aa1`, `00b7a233`). This is not
just a stale pointer. A legacy three-way merge simulation of Audit into remote
main found a docs/status conflict; preserve both current evidence and audit/design
history. No actual merge was performed.

Recommended sequence: preserve local-main work, bring Audit/design into current
remote main resolving docs, repair the grant/retry/test regressions, then start
`codex/subgraph-integration` from that reconciled remote-main baseline in its own
worktree. Integrate ENS/journey UI separately with product review; do not import
all old branches into the subgraph change. Use one canonical main, short-lived
feature branches, and one worktree per concurrent task.

## Verification performed

- `git fetch origin`, status/worktree inventory, ancestry and unique-commit counts,
  `git cherry origin/main origin/w1-privy-experiment`, source diffs.
- Extracted 78fc7d19 to `/private/tmp/venekovox-78fc-review`, linked existing deps,
  ran Node 22.20.0 `--test apps/front-end/tests/voteFlow.test.mjs`: loader failed
  before assertions. No full suite/build claimed.
- Read-only legacy `git merge-tree` simulations; no index/branch mutations.
- Review delivery changes only docs; existing runtime and branches preserved.
