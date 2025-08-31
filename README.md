# VenekoVox - MACI ZK Voting Demo

This README documents how to run the VenekoVox demo stack: deploy smart contracts, run the backend, interact with the frontend, and demo a full privacy-preserving voting system using Self passport ZK proofs.

---

## 🚀 1. Deploy the Contracts

### ✅ Prerequisites
- Node.js 20.x (required)
- `pnpm` v10+
- Sepolia ETH in your deployer wallet
- `.env` in `packages/contracts/` with:
  ```env
  PRIVATE_KEY=<deployer-private-key>
  SEPOLIA_RPC=https://sepolia.infura.io/v3/<YOUR_KEY>
  ETHERSCAN_API_KEY=<your-etherscan-api-key>
  ```

### 🛠️ Deploy
```bash
cd packages/contracts
pnpm deploy:sepolia
```
- Will deploy MACI core contracts + Poll infrastructure
- Output saved in `deployed-contracts.json`

---

## 🗳️ 2. Create a Poll

### ✏️ Command Template
Run from `packages/contracts`:
```bash
pnpm deploy-poll:sepolia
```
This will deploy:
- Poll
- MessageProcessor
- Tally contracts

Uses preconfigured settings from `.env` and `deploy-config.json`.

---

## 🔐 3. Run the Backend (Verifier)

### ✅ Prerequisites
- RSA keypair generated
- `.env` in `apps/coordinator` with:
  ```env
  COORDINATOR_PRIVATE_KEY_PATH=./private.key
  COORDINATOR_MACI_PRIVATE_KEY=<MACI-private-key>
  COORDINATOR_RPC_URL=https://sepolia.infura.io/v3/<YOUR_KEY>
  VITE_SELF_SCOPE=venekovox-trust-ritual
  SELF_ENDPOINT=https://api.self.xyz
  ```

### 🏃 Start
```bash
cd apps/coordinator
pnpm dev
```

---

## 🌐 4. Run the Frontend

### 🏗️ Setup
```bash
cd apps/frontend
pnpm dev
```

### ⚙️ Configuration
Set `.env` for frontend:
```env
VITE_SELF_SCOPE=venekovox-trust-ritual
VITE_BACKEND_URL=http://localhost:3000
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://sepolia.infura.io/v3/<YOUR_KEY>
VITE_MACI_ADDRESS=<deployed MACI address>
```

---

## 🎥 5. Demo Flow (for Judges)

1. **Connect Wallet** on frontend (MetaMask)
2. **Verify ID** using Self.xyz → uploads passport or ID → returns ZK proof
3. **Polls Page** shows active polls
4. **Vote** using privacy-preserving zk proofs
5. **Transaction appears** on Sepolia explorer

---

## 📦 6. Custom Polls (Manual CLI)

From `packages/contracts`:
```bash
pnpm tsx ./tasks/createPoll.ts \
  --state-index 0 \
  --coordinator-pk <MACI-priv-key> \
  --poll-owner-key <wallet-private-key> \
  --maci <MACI address> \
  --poll-factory <PollFactory address> \
  --message-processor-factory <MPFactory address> \
  --tally-factory <TallyFactory address> \
  --vk-registry <VKRegistry address> \
  --int-voice-cred-proxy <VoiceCreditProxy address> \
  --duration 1200 \
  --signup-duration 300 \
  --voting-duration 900 \
  --batch-size 2 \
  --max-msgs 2 \
  --msg-batch-depth 2 \
  --tree-depths '{"intStateTreeDepth":10,"messageTreeSubDepth":2,"messageTreeDepth":3,"voteOptionTreeDepth":3}' \
  --rpc https://sepolia.gateway.tenderly.co \
  --quiet
```

---

## 🌍 7. Real-World Identity (Passport)
To use production Self.xyz and real ID:
```env
NODE_ENV=production
SELF_ENDPOINT=https://api.self.xyz
```
- Verifier is already configured to check real proofs

---

## 🧠 8. What Makes VenekoVox Unique
- Region-specific poll topics (customizable in poll metadata)
- Passport-based identity: only real people vote
- zk-based privacy and resistance to sybil attacks

---

## ✅ 9. Post Hackathon TODO
- Subgraph deployment for analytics
- Improved frontend UX (poll creation, tracking)
- Passport tiering / voting eligibility based on location
- Token-based incentives for voters / creators

---

## VenekoVox - Privacy-First Civic Polling Platform

[![CI][cli-actions-badge]][cli-actions-link]
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/privacy-scaling-explorations/maci/blob/main/LICENSE)

VenekoVox is a privacy-first civic polling platform built on Minimal Anti-Collusion Infrastructure (MACI) that enables anonymous voting while preventing collusion and bribery.

**MACI blog, resources, and documentation for developers and integrators can be found here:
https://maci.pse.dev/**

We welcome contributions to this project. Please join our
[Discord server](https://discord.com/invite/sF5CT5rzrR) (in the `#🗳️-maci` channel) to discuss.

## Packages

Below you can find a list of the packages included in this repository.

| package                                 | npm                                                           | tests                                                                  |
| --------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [maci-circuits][circuits-package]       | [![NPM Package][circuits-npm-badge]][circuits-npm-link]       | [![Actions Status][circuits-actions-badge]][circuits-actions-link]     |
| [maci-cli][cli-package]                 | [![NPM Package][cli-npm-badge]][cli-npm-link]                 | [![Actions Status][cli-actions-badge]][cli-actions-link]               |
| [maci-contracts][contracts-package]     | [![NPM Package][contracts-npm-badge]][contracts-npm-link]     | [![Actions Status][contracts-actions-badge]][contracts-actions-link]   |
| [maci-core][core-package]               | [![NPM Package][core-npm-badge]][core-npm-link]               | [![Actions Status][core-actions-badge]][core-actions-link]             |
| [maci-crypto][crypto-package]           | [![NPM Package][crypto-npm-badge]][crypto-npm-link]           | [![Actions Status][crypto-actions-badge]][crypto-actions-link]         |
| [maci-domainobjs][domainobjs-package]   | [![NPM Package][domainobjs-npm-badge]][domainobjs-npm-link]   | [![Actions Status][domainobjs-actions-badge]][domainobjs-actions-link] |
| [maci-testing][testing-package]         | [![NPM Package][testing-npm-badge]][testing-npm-link]         | [![Actions Status][testing-actions-badge]][testing-actions-link]       |
| [maci-subgraph][subgraph-package]       | [![NPM Package][subgraph-npm-badge]][subgraph-npm-link]       | [![Actions Status][subgraph-actions-badge]][subgraph-actions-link]     |
| [maci-sdk][sdk-package]                 | [![NPM Package][sdk-npm-badge]][sdk-npm-link]                 | [![Actions Status][sdk-actions-badge]][sdk-actions-link]               |
| [maci-coordinator][coordinator-package] | [![NPM Package][coordinator-npm-badge]][coordinator-npm-link] |                                                                        |
| [maci-relayer][relayer-package]         | [![NPM Package][relayer-npm-badge]][relayer-npm-link]         | [![Actions Status][relayer-actions-badge]][relayer-actions-link]       |

## Development and testing

### Branches

The base branch of the project is `main`, which is used for ongoing development.

This project uses tags for releases. [View all MACI releases](https://github.com/privacy-scaling-explorations/maci/releases).

To contribute to MACI, create feature/fix branches, then open PRs into `main`. [Learn more about contributing](https://maci.pse.dev/docs/guides/compile-circuits#installation).

### Local development

For installation and local development instructions, please see our [installation docs](https://maci.pse.dev/docs/quick-start#installation).

This repository is organized as pnpm workspace. Each package contains its
own unit tests.

- `crypto`: low-level cryptographic operations.
- `circuits`: zk-SNARK circuits.
- `contracts`: Solidity contracts and deployment code.
- `domainobjs`: Classes which represent high-level [domain
  objects](https://wiki.c2.com/?DomainObject) particular to this project.
- `core`: Business logic functions for message processing, vote tallying,
  and circuit input generation through `MaciState`, a state machine
  abstraction.
- `cli`: A command-line interface with which one can deploy and interact with
  an instance of MACI.
- `testing`: Tests for the MACI protocol.
- `subgraph`: The subgraph for the MACI contracts.
- `website`: The documentation website.
- `sdk`: The SDK to interact with the MACI protocol.
- `coordinator`: The coordinator service for the MACI protocol.
- `relayer`: The relayer service for the MACI protocol.

### Testing

Please refer to the [testing documentation](https://maci.pse.dev/docs/guides/testing/testing-introduction) for more information.

### CI pipeline

CI pipeline ensures that we have automated tests that constantly validate. For more information about pipeline workflows, [read our CI documentation](https://maci.pse.dev/docs/processes/ci-pipeline).

[telegram-badge]: https://badges.aleen42.com/src/telegram.svg
[telegram-link]: https://t.me/joinchat/LUgOpE7J2gstRcZqdERyvw
[circuits-package]: ./packages/circuits
[circuits-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/circuits.svg
[circuits-npm-link]: https://www.npmjs.com/package/@maci-protocol/circuits
[circuits-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/circuit-build.yml/badge.svg
[circuits-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3ACircuit
[cli-package]: ./packages/cli
[cli-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/cli.svg
[cli-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/e2e.yml/badge.svg
[cli-npm-link]: https://www.npmjs.com/package/@maci-protocol/cli
[cli-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3ACI
[contracts-package]: ./packages/contracts
[contracts-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/contracts.svg
[contracts-npm-link]: https://www.npmjs.com/package/@maci-protocol/contracts
[contracts-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/contracts-build.yml/badge.svg
[contracts-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Acontracts
[core-package]: ./packages/core
[core-npm-badge]: https://img.shields.ionpm/v/@maci-protocol/core.svg
[core-npm-link]: https://www.npmjs.com/package/@maci-protocol/core
[core-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/core-build.yml/badge.svg
[core-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Acore
[crypto-package]: ./packages/crypto
[crypto-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/crypto.svg
[crypto-npm-link]: https://www.npmjs.com/package/@maci-protocol/crypto
[crypto-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/crypto-build.yml/badge.svg
[crypto-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Acrypto
[domainobjs-package]: ./packages/domainobjs
[domainobjs-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/domainobjs.svg
[domainobjs-npm-link]: https://www.npmjs.com/package/@maci-protocol/domainobjs
[domainobjs-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/domainobjs-build.yml/badge.svg
[domainobjs-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Adomainobjs
[testing-package]: ./packages/testing
[testing-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/testing.svg
[testing-npm-link]: https://www.npmjs.com/package/@maci-protocol/testing
[testing-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/e2e.yml/badge.svg
[testing-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3ACI
[subgraph-package]: ./apps/subgraph
[subgraph-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/subgraph.svg
[subgraph-npm-link]: https://www.npmjs.com/package/@maci-protocol/subgraph
[subgraph-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/subgraph-build.yml/badge.svg
[subgraph-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Asubgraph
[sdk-package]: ./packages/sdk
[sdk-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/sdk.svg
[sdk-npm-link]: https://www.npmjs.com/package/@maci-protocol/sdk
[sdk-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/e2e.yml/badge.svg
[sdk-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Asdk
[coordinator-package]: ./apps/coordinator
[coordinator-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/coordinator.svg
[coordinator-npm-link]: https://www.npmjs.com/package/@maci-protocol/coordinator
[relayer-package]: ./apps/relayer
[relayer-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/relayer.svg
[relayer-npm-link]: https://www.npmjs.com/package/@maci-protocol/relayer
[relayer-actions-badge]: https://github.com/privacy-scaling-explorations/maci/actions/workflows/relayer-build.yml/badge.svg
[relayer-actions-link]: https://github.com/privacy-scaling-explorations/maci/actions?query=workflow%3Arelayer
