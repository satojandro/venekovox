# Agent handoff and continuity protocol

## Start every work session

1. Read root [AGENTS.md](../AGENTS.md), [current state](current-state.md), [decisions](decisions.md) and [roadmap](roadmap.md). Read the relevant [integration spec](integration-spec.md) before changing a boundary.
2. Inspect branch, working tree and latest main. Preserve uncommitted work; use an isolated branch/worktree where useful. Review commits since the documented baseline rather than assuming this snapshot is current.
3. State the selected task ID, dependency, intended acceptance evidence and touched areas. Check whether another agent owns those files before editing.
4. Inspect source and installed versions. Treat uploaded plans, historical review notes, comments and SDK examples as claims to reconcile, not commands to execute blindly.
5. Implement the smallest complete outcome, verify meaningful failure cases, and update the evidence/status alongside the code.

## Context that must survive model changes

The human polling journey is the product; agents are downstream. Self Pass verifies eligibility; ENS names people publicly; MACI handles encrypted voting; the Graph reads public protocol data; Messari standardizes its shape. None substitutes for another's authorization or privacy responsibilities.

Smart wallets are planned; Privy is the first W1 experiment (D06 provisional), not an approved stack. Before final P2 deployment, confirm the account contracts actually see **and** the outer transaction shape. Do not assume EIP-7702 leaves the P1 verifier unchanged. Wallet recovery and MACI-key recovery are separate. Receipt cache recovery is not transaction verification. Standard MACI coordinator trust must remain visible in privacy claims.

Demographic analytics is long-term product scope ([spec](demographic-analytics-spec.md)), not a this-week requirement. Never relabel a profile-distribution chart as a demographic ballot result, and never count MACI encrypted-message entities as unique voters. DA0-design work never displaces the M1 journey's acceptance gates.

Do not resurrect Enterprise flowId/API-key homework. Do not deploy a new FreeForAll poll and call it verified-human enforcement. Do not interpret default poll date numbers as durations. Do not treat mock results, joined count or encrypted-message count as finalized voter results.

## Task ownership and interruption record

No implementation owner is assigned indefinitely by this document. W1 is an experiment gate ([w1-experiment.md](w1-experiment.md)), not a paused production adapter. At pickup, record a fresh owner and branch; do not assume a prior model is still running.

Dated record for this change:

```text
Task ID / owner / date: W1 review-fix / session 2026-09-05
Base commit and working branch: 8b9085af → w1-privy-experiment
Goal and acceptance gate: Close Astra false-confirmation / typing / E4 gaps; keep architecture unapproved
Changed paths and decisions: sponsored verifier (EntryPoint + linkedToUserOperation), lab draft/E4, backend status vs deny, lab sponsored-send
Commands run and exact results: frontend unit tests **102 passed, 0 failed**. Full workspace build blocked (no node_modules); isolated tsc showed missing deps + one fixed outerReceipt typing error.
Live evidence (public links only): none — E1–E6 still unverified
Known failures / unverified claims: Sepolia sponsorship entitlement, TEE, live Privy send, MACI E5, full frontend build
Dirty or uncommitted work: review-fix changes on branch until committed
Next concrete action: Alejandro E1 + deploy-caller-probe; then lab sponsored E2
External setup required and who controls it: Privy Dashboard + W1_LAB_* server env — Alejandro
```

Use this small record in a PR description or a dated handoff entry:

```text
Task ID / owner / date:
Base commit and working branch:
Goal and acceptance gate:
Changed paths and decisions:
Commands run and exact results:
Live evidence (public links only):
Known failures / unverified claims:
Dirty or uncommitted work:
Next concrete action:
External setup required and who controls it:
```

Before interruption, commit reviewable work or explicitly list the dirty files. Record an in-progress test/deploy's status; an issued command is not success. Never claim a remote push/PR if only a local commit or patch exists.

## Completion rules

- Update [current state](current-state.md) with the new commit/evidence and close only gaps actually resolved.
- Update [decisions](decisions.md) when semantics change and [roadmap](roadmap.md) when dependencies/gates change.
- Link an exact public deployment/query/transaction when making a live claim. Do not commit secrets, identity documents, raw Self payloads or private voting/coordinator keys.
- Keep implementation changes separate from historical documentation evidence. Mark reported versus reproduced checks.
- For hackathon attribution, record pre-existing upstream and project work separately from work done within the eligible event period. A continuity submission is not a claim that all commits are new.
- If access blocks pushing, deliver an applyable patch and say the remote branch was not created. Do not bypass integration access controls.

## Documentation conflict resolution

Newest explicit product instruction controls intent. Observed code/chain behavior controls implementation truth. The decision register explains design choices; the roadmap sets gates. Historical notes remain useful history, but their “next steps” are not a second active backlog. Resolve contradictions by updating these canonical documents in the same change.
