# Development and demo runbook

These commands are grounded in the reviewed package scripts. They are not a claim that all services or live integrations were exercised. Run local commands from the repository root unless a working directory is explicitly shown. Never paste private keys, identity documents or raw verification payloads into chat.

## 1. Prepare the workspace

Use repository-supported Node 20 and pnpm 9 or 10. Install workspace dependencies and build the local MACI packages before treating frontend errors as application defects:

```sh
pnpm install --frozen-lockfile
pnpm build
```

The full build includes multiple projects and may require additional circuit/toolchain resources. Record the actual failure if blocked; do not describe an unrun build as green. The current documentation review ran only the targeted tests below, not a fresh full dependency installation/build.

Copy `apps/front-end/.env.example` to `apps/front-end/.env.local` and replace the historical poll configuration with verified values before a live demo. All `VITE_*` values are browser-visible. Keep private backend/deployer values outside version control.

Frontend public configuration: `VITE_SELF_SCOPE`, `VITE_SELF_ENDPOINT`, `VITE_MACI_ADDRESS`, `VITE_CHAIN_ID`, `VITE_POLL_ID`, `VITE_MACI_START_BLOCK`, `VITE_WALLET_SOURCE` (must stay `injected` until W1 E1–E6 pass). Backend verification reads `SELF_SCOPE`, `SELF_ENDPOINT`, `MOCK_PASSPORT`, and the server port configuration. Optional W1 status proxy reads `PRIVY_APP_ID` / `PRIVY_APP_SECRET` on the server only — never `VITE_` those. Frontend/backend scope, callback endpoint and mock environment must agree.

## 2. Start and check services

In separate terminals, from the repository root:

```sh
pnpm --dir apps/backend dev
```

```sh
pnpm --dir apps/front-end dev
```

The backend defaults to port 3100 and exposes `/health`, `/verify`, and `/w1/transactions/:id` (503 until Privy server credentials exist). The W1 lab UI is `/w1` and is not the voting product. Check the actual frontend origin printed by Vite; the backend CORS list currently does not include default port 3000 (G10). Align the configuration/code before expecting browser verification to work.

Self Pass's mobile proof callback needs a publicly reachable verifier for the staging flow; localhost on the developer machine is not reachable from a phone. Configure a public HTTPS tunnel or deployment, then align the exact request/verifier endpoint. Use Self's supported mock-passport environment for staging, visibly labeled. It still exercises the mobile proof flow; a stubbed browser callback is not equivalent. A real-document verification remains an M1 gate.

## 3. Provision browser proving assets

The vote flow references `/zkeys/PollJoining_10_test/` WASM and `.0.zkey` assets. They are not present in this checkout's frontend public directory. The repository supplies `pnpm download-zkeys:test`, but downloading at the root does not automatically serve assets through Vite.

Confirm the exact filenames in [voteFlow.ts](../apps/front-end/src/hooks/voteFlow.ts), obtain the matching trusted test artifacts, place or serve them at those URLs, and verify response bytes/hash and circuit depth against the deployed configuration. Test keys/assets are for the labeled test environment. Do not substitute mismatched depth or ceremony artifacts to make a request return HTTP 200.

## 4. Select or deploy a poll

Before any deployment, settle P2 policy, account binding and ballot mode/credits. Alejandro controls and funds deployer/voter accounts. Review [Hardhat configuration](../packages/contracts/hardhat.config.ts) locally with the operator; do not fall back to a test mnemonic on a public network.

The deploy task reads `Poll.pollStartDate` and `Poll.pollEndDate` in the selected network's deploy configuration. These are **absolute UNIX seconds**, not relative durations. Existing `3600` placeholders are not a future one-hour window. Set explicit start/end times with enough time for verification and proving, and read them back after deployment.

Inspect task help from the contracts package before constructing commands:

```sh
pnpm --dir packages/contracts exec hardhat deploy-poll --help
```

Existing scripts include:

```sh
pnpm --dir packages/contracts deploy:sepolia
pnpm --dir packages/contracts deploy-poll:sepolia
```

These mutate the chain and spend funds. The first deploys the broader stack; the second deploys a poll against the configured deployment. They are alternatives selected after reviewing policy/deployment state, not two mandatory quickstart commands. The task catches/logs some failures, so a successful shell exit is insufficient evidence.

Verify chain ID, bytecode, MACI-to-poll address mapping, `getStartAndEndDate()`, policy contracts, coordinator public key, mode/credits/options and circuit depths. Do not assume the newest local JSON corresponds to the selected chain.

Commit a public deployment manifest when verified: date, operator, chain ID, MACI/poll/policy/processor/tally addresses, poll ID, tx hashes and blocks, schedule, mode, option count, circuit/artifact hashes, scan start, metadata hash and verification block. Exclude keys and personal data. This manifest is a required future artifact, not currently supplied proof.

## 5. Close, prove and publish results

Available contracts scripts are `merge:sepolia`, `prove:sepolia`, and `submitOnChain:sepolia`. Inspect each underlying task's help and required coordinator/proving artifacts before use. Keep coordinator secrets under operator control.

Verify each checkpoint: poll closed → state merged → messages processed/proofs accepted → tally commitment verified → aggregate results checked/published → Graph indexed → UI displays the same values. Current integration is incomplete; follow P4 in the [integration spec](integration-spec.md). Never mark merging alone as final results.

## 6. Build/deploy the subgraph

Edit schema sources in `apps/subgraph/schemas`, network config in `apps/subgraph/config`, and YAML templates in `apps/subgraph/templates`; generated `schema.graphql`/`subgraph.yaml` are not the canonical design inputs.

```sh
pnpm --dir apps/subgraph build
```

The default version is v1; v2 does not exist at the review baseline. Build invokes code generation. The default deploy scripts name the upstream `maci-subgraph`; select a project-owned Studio name and credentials explicitly before deploying. Record the deployment/version, endpoint, network, indexed head, errors and a real query response. Studio deployment alone does not connect the frontend or produce finalized tally data.

## 7. Verification commands and evidence

Current focused regression suite:

```sh
pnpm --dir apps/front-end test:unit
```

This runs `voteFlow`, `receipts`, `receiptStatus`, `hydration`, and W1 sponsored-verifier/adapter tests. On Node 20 it uses installed TypeScript; newer Node can use native stripping. Record the exact pass/fail counts from the command; do not copy a previous snapshot. These tests do not prove Privy sponsorship, Sepolia entitlement, or a live MACI sponsored vote. Supported-toolchain checks for an implementation change include:

```sh
pnpm --dir apps/front-end build
pnpm types
```

Use the existing repository lint/format checks on changed files. These unit tests do not exercise React component mount, actual Self proofs, browser proving, live chain receipt provenance or tally/indexer correctness.

## 8. W1 sponsored-execution experiment

Do not wire Privy into voting until [w1-experiment.md](w1-experiment.md) E1–E6 have evidence. Deploy `CallerProbe` with Alejandro’s key (never paste it into chat):

```sh
pnpm --dir packages/contracts exec hardhat compile
pnpm --dir packages/contracts exec hardhat deploy-caller-probe --network sepolia
```

Put the probe address in `VITE_W1_PROBE_ADDRESS`. Put `PRIVY_APP_ID` / `PRIVY_APP_SECRET` on the backend only. Lab UI: `/w1`. Record observations in [w1-evidence.md](w1-evidence.md).

Record live smoke evidence under the [judge checklist](judges.md): exact release commit, environment, public tx/query links, expected versus actual outcomes and limitations. Do not capture passport details, raw proof payloads, secrets or ballot-key material in recordings.
