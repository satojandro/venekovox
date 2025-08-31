# VenekoVox - Privacy-First Civic Polling Platform

[![CI][cli-actions-badge]][cli-actions-link]
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/privacy-scaling-explorations/maci/blob/main/LICENSE)

VenekoVox is a privacy-first civic polling platform built on Minimal Anti-Collusion Infrastructure (MACI) that enables anonymous voting while preventing collusion and bribery.

**MACI blog, resources, and documentation for developers and integrators can be found here:
https://maci.pse.dev/**

We welcome contributions to this project. Please join our
[Discord server](https://discord.com/invite/sF5CT5rzrR) (in the `#🗳️-maci` channel) to discuss.

## VenekoVox Frontend Setup

### Prerequisites

- Node.js 18+
- pnpm
- Self.xyz API credentials (contact Self.xyz for access)

### Installation

1. Install frontend dependencies:
```bash
cd apps/front-end
pnpm install
```

2. Install backend dependencies:
```bash
cd ../backend
npm install
cd ..
```

3. Configure environment variables:

   **Frontend** (`.env.local` in `apps/front-end/`):
   ```env
   VITE_SELF_SCOPE=venekovox-trust-ritual
   VITE_SELF_ENDPOINT=http://localhost:3001/verify
   ```

   **Backend** (`.env` in `apps/backend/`):
   ```env
   VITE_SELF_SCOPE=venekovox-trust-ritual
   SELF_ENDPOINT=https://api.self.xyz
   PORT=3001
   ```

4. Start both services:

   **Terminal 1 - Backend:**
   ```bash
   cd apps/backend
   npm run dev
   ```

   **Terminal 2 - Frontend:**
   ```bash
   cd apps/front-end
   pnpm dev
   ```

### Trust Ritual Flow

The Trust Ritual implements Self.xyz identity verification:

1. **QR Code Generation**: Users scan a QR code with the Self mobile app
2. **Identity Verification**: Self app scans passport/ID and generates zk-proof
3. **Anonymous Storage**: Only hashed country, age, gender are stored locally
4. **Voting Eligibility**: Verified users can participate in anonymous polls

### Testing the Integration

#### Enable Mock Passports for Testing

1. **Download Self App**: Get the Self mobile app on iOS/Android
2. **Enable Debug Mode**: Tap the Self card **5 times with 2 fingers** to unlock debug menu
3. **Use Playground**: Visit https://playground.staging.self.xyz for testing

#### Test Steps

1. **Start Backend**: `cd apps/backend && npm run dev`
2. **Start Frontend**: `cd apps/front-end && pnpm dev`
3. **Navigate**: Go to `http://localhost:5173/trust-ritual`
4. **Scan QR**: Use Self app in debug mode to scan the QR code
5. **Verify**: Check backend logs and frontend success state

#### Mock vs Production

- ✅ **Development**: `mockPassport: true` (accepts test documents)
- ✅ **Production**: `mockPassport: false` (requires real documents)
- ✅ **Testing**: Use playground to simulate different demographics

### Key Features

- **Zero-Knowledge Proofs**: Identity verified without revealing personal data
- **Anonymous Voting**: MACI ensures vote privacy and prevents collusion
- **Multi-language Support**: English and Spanish interfaces
- **Responsive Design**: Works on desktop and mobile devices

### Backend Verification Setup

For production, implement the backend verification endpoint:

```javascript
// pages/api/verify.js (Next.js) or your backend route
import { SelfBackendVerifier, UserIdType } from '@selfxyz/core';

export default async function handler(req, res) {
  const allowedIds = new Map();
  allowedIds.set(1, true); // Passport

  const configStorage = new (class {
    async getConfig() {
      return { olderThan: 18, excludedCountries: [], ofac: false };
    }
    async getActionId(u, d) { return 'default'; }
  })();

  const verifier = new SelfBackendVerifier(
    'venekovox-trust-ritual', // Must match frontend scope
    process.env.SELF_ENDPOINT, // Your frontend endpoint URL
    false, // Production mode
    allowedIds,
    configStorage,
    UserIdType.HEX // Matches frontend userIdType
  );

  if (req.method === 'POST') {
    const { attestationId, proof, pubSignals, userContextData } = req.body;
    const result = await verifier.verify(attestationId, proof, pubSignals, userContextData);

    return res.status(200).json({
      status: result.isValidDetails.isValid ? 'success' : 'error',
      verifyOutput: result.discloseOutput
    });
  }

  res.status(405).end();
}
```

### API Integration

The frontend integrates with:
- **Self.xyz**: Identity verification and zk-proof generation
- **MACI Protocol**: Anonymous voting infrastructure
- **IPFS/Filecoin**: Decentralized storage for poll data

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
[core-npm-badge]: https://img.shields.io/npm/v/@maci-protocol/core.svg
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
