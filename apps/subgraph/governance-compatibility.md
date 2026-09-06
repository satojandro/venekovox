# MACI governance extension v2 — contribution and demo handoff

Status: implemented locally; proposed upstream contribution, not an accepted Messari
standard. Base VenekoVox main: `c12361c3ac2797f98e1238cdca669227fc43ebcc`.

## Reference and actual contribution

Pinned upstream: `messari/subgraphs@2711ac91ef119f321f65b339e10a57f9aa74f9d8`,
[`subgraphs/openzeppelin-governor/schema.graphql`](https://github.com/messari/subgraphs/blob/2711ac91ef119f321f65b339e10a57f9aa74f9d8/subgraphs/openzeppelin-governor/schema.graphql).
The exact file and its license are in `reference/`. At this revision there is **no
root `schema-governance.graphql`**. Governance implementations exist for OpenZeppelin,
Alpha/Bravo and Aave; do not cite a nonexistent shared base or claim all those schemas
were compared. The compatibility tests cover the pinned OpenZeppelin reference only.

The contribution is an implementable proposal for private governance data: a reusable
common proposal query, a MACI adapter, explicit ballot visibility/coordinator trust,
and honest absence of private results. This extends our existing MACI subgraph. It
is not a drop-in replacement for all Messari queries and does not retrofit privacy
fields into a deployed Governor subgraph.

## Compatibility contract

| Field/model                                                          | MACI v2 decision                                             | Reason                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `GovernanceFramework.id/name/type/contractAddress`                   | Retained names/types; add `MACI` enum value                  | Common identity across implementations                                     |
| `Proposal.id/txnHash/creationBlock/creationTime/governanceFramework` | Same query fields and scalar meanings                        | Reusable discovery/provenance query                                        |
| `Proposal.description`                                               | Nullable                                                     | MACI creation event has no question text; never synthesize a real question |
| `startBlock/endBlock`                                                | Nullable, unset                                              | MACI uses Unix-time windows, exposed separately as `startTime/endTime`     |
| Token/delegate/timelock fields                                       | Omitted from the MACI projection                             | No fabricated addresses or zero-valued token statistics                    |
| Native MACI `Vote`                                                   | Preserved as legacy ciphertext entity                        | It is NOT Messari's individual public vote model                           |
| Proposal-level individual votes                                      | Not exposed                                                  | No ciphertext-to-choice/voter inference                                    |
| `BallotPrivacy`                                                      | `ENCRYPTED`                                                  | Ballots are not public choices                                             |
| `CoordinatorTrust`                                                   | `COORDINATOR_CAN_DECRYPT`                                    | Separate from public visibility; no absolute anonymity claim               |
| `TallyStatus`                                                        | `UNAVAILABLE`                                                | This slice has no verified tally ingestion                                 |
| Weighted results, counted ballots, result provenance                 | Nullable and unset                                           | Unavailable does not mean zero or abstain                                  |
| `registrationCount`                                                  | Observed unique poll-key registration records                | Not verified humans or counted ballots                                     |
| `publishedMessageCount`                                              | Direct publication events, excluding constructor placeholder | Replacement/invalid commands are possible; never call this turnout         |
| `offchainBatchCount`                                                 | IPFS hash announcement events                                | Not an authenticated count of payload messages                             |
| `voteOptionCapacity`                                                 | Contract capacity                                            | Not a list of actual question choices                                      |

The original v1 entities remain structurally identical for existing readers. The new
mappings require v2; `VERSION=v1` is a historical schema selection, not a supported
build of the new mapping code. Roll back the mapping revision as well to build v1.
Reindex from the correct MACI deployment block: existing entities will not backfill
new Proposal records simply because the schema was redeployed.

No result fields are inferred from `MergeState`, the closing time, registrations,
message count or a caller-supplied file. S4.1 must validate tally commitments and
supply result provenance before implementing a VERIFIED writer. `client/governance.mjs`
fails closed on an unsupported future tally status so readers cannot silently upgrade
an unverified claim. Public Governor totals are labeled as public totals, not an
independent confirmation of finality. Neither source is representative polling data.

## What runs now

- `src/governance.ts` is called from the actual DeployPoll, PublishMessage,
  PollJoined and IpfsHashAdded handlers.
- `client/governance.mjs` exports a reusable product read adapter and `COMMON_QUERY`.
  The exact common query validates against both schemas. Source-specific fields then
  explain what can and cannot be observed. Read results carry source labels and indexed
  block/hash; do not merge IDs across networks/endpoints without source scoping.
- `client/compare.mjs` fetches both configured live endpoints and produces a comparative
  JSON answer. It rejects GraphQL/indexer errors and has no fixture fallback. It is a
  deterministic read client, not an AI agent or a completed Bazantic integration.
- No frontend, wallet, identity or backend route changes. The product/agent layer can
  import the read adapter after endpoint configuration; it is not wired into the main
  polling UI by this patch. The native UI's question metadata and results work remain.

## Local validation

Use the repository Node/pnpm environment. No dependency or lock change is needed:
Graph CLI/graph-ts already belong to this package; TypeScript is a root development
dependency. The schema tests resolve GraphQL through Graph CLI's dependency boundary.

```sh
pnpm --dir apps/subgraph codegen
pnpm --dir apps/subgraph build
pnpm --dir apps/subgraph test:governance
```

Reproduced on Node 24.19.0 with isolated copies of the pinned tools:
Graph CLI 0.97.1, graph-ts 0.38.1, contracts npm package 3.0.0, TypeScript 5.9.2.
Code generation and WASM build passed. All 17 tests passed: shared-query/schema
compatibility, production mapping functions with deterministic Graph host doubles,
and client failure/normalization cases. The mapping tests are **not** Matchstick or
live graph-node execution. Full workspace/Matchstick/browser suites were not run.
The build used published 3.0.0 contract ABIs; repeat normal codegen against the merged
workspace's contract artifacts before release if those contracts changed.

### Hermes independent re-verification — 2026-09-06

Reproduced in the merged workspace on branch `s5-governance` at `c580b245b`:

| Claim                                      | Result                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `pnpm --dir apps/subgraph codegen`         | PASS (types generated)                                                          |
| `pnpm --dir apps/subgraph build`           | PASS — `build/MACI/MACI.wasm` 47404 B, `build/templates/Poll/Poll.wasm` 48858 B |
| `pnpm --dir apps/subgraph test:governance` | PASS — 17 tests, 0 fail                                                         |

Environment difference: reproduced on Node 26.3.0 / pnpm 12.3.4, not Node 24.19.0.
The repository pins `engines.node >=22 <23` (root `package.json`), so neither runtime is
the declared one; codegen, WASM build and all tests nonetheless passed on this machine.
Re-run under the declared range before treating this as release evidence.

One integration trap, recorded so it is not repeated: run `pnpm codegen`, never
`graph codegen` directly. The `precodegen` hook is what copies
`schemas/schema.v2.graphql` to `schema.graphql`; invoking the binary directly leaves the
stale v1 schema in place and the build fails with
`Module 'generated/schema' has no exported member 'GovernanceFramework'`.

AssemblyScript `==` vs `===`: repo ESLint (`eqeqeq`) flags
`proposal.txnHash == event.transaction.hash.toHexString()` in `src/governance.ts`.
The autofix is WRONG here and is suppressed with a recorded reason. In AssemblyScript,
`String` overloads `@operator("==")` to do VALUE comparison (assemblyscript 0.19.23
`std/assembly/string.ts:109`), while `===` is reference identity. Verified empirically
by compiling both forms with `asc` and executing the WASM: `==` returned 1 (value),
`===` returned 0 (reference). Applying `===` would compile and silently never match,
so every publication would be counted. Any future `eqeqeq` hit in `apps/subgraph/src`
must be checked the same way before "fixing".

Astra's four documentation hunks conflicted with the newer P2 Enterprise and
node-runtime commits on main and were 3-way merged, not overwritten: P2's D02
Enterprise supersession, D11 candidate status and P2 evidence sections are preserved.
Only Astra's narrow deltas were adopted (Messari row, D14 status, S5 sections).

## Live demo: finish this before claiming prize qualification

1. Hermes selects the working MACI deployment. Check the configured chain, address and
   start block in `config/network.json`; these currently retain the repository's old
   Sepolia deployment. Do not mistake it for the new P2 deployment or invent a new address.
2. Create a project-owned Subgraph Studio entry, authenticate privately, and deploy v2
   with a project-specific slug. Existing legacy scripts target `maci-subgraph`; use
   an explicit reviewed slug rather than accidentally publishing over another project.

   ```sh
   pnpm --dir apps/subgraph exec graph deploy YOUR_PROJECT_SLUG --version-label governance-v2
   ```

3. Wait for indexing and run `COMMON_QUERY`. Confirm `_meta.hasIndexingErrors=false`,
   indexed block progress and proposal provenance against chain transactions. Empty
   responses are valid data but not a compelling demonstration; seed an actual poll,
   join and publication through the working app rather than fabricate indexer rows.
4. Configure `MACI_GRAPH_URL` and `GOVERNOR_GRAPH_URL` privately. The second must be a
   live Graph-provider deployment with the pinned Governor schema's query surface.
   No reference endpoint has been selected or live-verified in this patch. Do not
   commit API-key-bearing URLs or print them in a recording.
5. Run `pnpm --dir apps/subgraph demo:governance`. Save a sanitized response with source
   deployment IDs, networks and retrieval time. This is **client composition across
   two endpoints**, not a federated query served by one subgraph.
6. Record a short demo: common query → real private/public proposals → explanation of
   why commands differ from ballots and private results differ from zero → actual
   VenekoVox use. A main-app consumer or agent still needs wiring; showing this CLI
   alone does not establish a finished product integration.

Suggested demo question: “Which recent proposals can I inspect across these two
systems, and what participation/results information is actually available?” Never
rank unique-human turnout using token weights or message counts.

## Upstream-ready scope and submission boundary

Prepare a contribution proposal with this compatibility table, pinned reference,
MACI schema/mappings, common-query tests and real deployment/demo evidence. Ask
maintainers whether a shared private-governance interface or protocol extension fits
best. Do not present omitted token fields as full compatibility or modify the entire
Governor family as a hackathon prerequisite. Opening/acceptance of an upstream PR
is not claimed here; no message or PR was sent.

Graph prize requirements require live provider data and a meaningful standards benefit.
This patch establishes a locally tested implementation, not completed prize evidence.
AI Continuity additionally needs meaningful agent behavior; Bazantic needs its real
platform Recipe/gateway and controlled comparison. ENS remains separate.
[Official prizes](https://ethglobal.com/events/ethonline2026/prizes)
