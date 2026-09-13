# ENS V2 Deployment — Sepolia Verification Guide

> **For hackathon judges and reviewers.** Every address and transaction below is
> verifiable on Sepolia Etherscan. No private keys, secrets or local-only state
> is required to confirm the deployment.

## Summary

VenekoVox integrates **ENS V2 (Beta)** on Sepolia to give participants optional,
human-readable poll and profile names. Names are public, gas-funded and unrelated
to MACI eligibility or voting privacy.

The deployment was executed on **2026-09-13** from address
`0xE13208E10Bb61F663e5A218A9774A99E671eec6D`.

---

## Contract Addresses

| Contract                                  | Sepolia Address                              | Sepolia Etherscan                                                                       |
| ----------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| **VenekoVoxNames** (registrar + resolver) | `0x870A12e8274A165C7bCa64B563aAaeD2655E8369` | [View](https://sepolia.etherscan.io/address/0x870A12e8274A165C7bCa64B563aAaeD2655E8369) |
| venekovoxv1.eth UserRegistry              | `0x9C4e4Ba2f58DEDd25677cdfaE75A923de0bA9970` | [View](https://sepolia.etherscan.io/address/0x9C4e4Ba2f58DEDd25677cdfaE75A923de0bA9970) |
| people.venekovoxv1.eth UserRegistry       | `0x88191d9203280395cE427f24e207d3D52C93799B` | [View](https://sepolia.etherscan.io/address/0x88191d9203280395cE427f24e207d3D52C93799B) |
| polls.venekovoxv1.eth UserRegistry        | `0xE9eE800F8Dbd6E6Bd7234054516845Af99B7F6F1` | [View](https://sepolia.etherscan.io/address/0xE9eE800F8Dbd6E6Bd7234054516845Af99B7F6F1) |

### External ENS V2 Contracts Used

| Contract           | Address                                      | Source                                                  |
| ------------------ | -------------------------------------------- | ------------------------------------------------------- |
| ENSv2 RootRegistry | `0x8115186e8f2e0b0281e86ab91f0f48ba90364354` | [ENS Docs](https://docs.ens.domains/learn/deployments/) |
| ETHRegistry (.eth) | `0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2` | [ENS Docs](https://docs.ens.domains/learn/deployments/) |
| ETHRegistrar       | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` | [ENS Docs](https://docs.ens.domains/learn/deployments/) |
| VerifiableFactory  | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` | [ENS Docs](https://docs.ens.domains/learn/deployments/) |
| UserRegistryImpl   | `0x624a25d67b59d587752ebec8dded8827dae52050` | [ENS Docs](https://docs.ens.domains/learn/deployments/) |
| MACI               | `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a` | Already deployed (see status.md)                        |

---

## ENS V2 Hierarchy

```
.eth (ETHRegistry: 0xBDC85dD5...)
└── venekovoxv1 (UserRegistry: 0x9C4e4Ba2...)
    ├── people (UserRegistry: 0x88191d92...)
    │   └── <label>.people.venekovoxv1.eth  ← profile names
    └── polls (UserRegistry: 0xE9eE800F...)
        └── <label>.polls.venekovoxv1.eth   ← poll names (operator only)
```

---

## Deployment Transactions

All transactions are from `0xE13208E10Bb61F663e5A218A9774A99E671eec6D`.

### Step 1: Register `venekovoxv1.eth` on ENS V2

| Action                          | Tx Hash                                                              | Etherscan                                                                                                  |
| ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Commit (commit-reveal step 1)   | `0xf1e012b16ff86d314b42c4697f7121026aaf73e837f7bc51ba1ae0f1a33ad81f` | [View](https://sepolia.etherscan.io/tx/0xf1e012b16ff86d314b42c4697f7121026aaf73e837f7bc51ba1ae0f1a33ad81f) |
| Register (commit-reveal step 2) | `0x83bac27458dc0cee72778b2f4783199f5f7bc6bf33ef23f91d65d1b4758554e7` | [View](https://sepolia.etherscan.io/tx/0x83bac27458dc0cee72778b2f4783199f5f7bc6bf33ef23f91d65d1b4758554e7) |

Registration used the official **ETHRegistrar** (`0xa88553f4...`) with
commit-reveal front-running protection (60s minimum commitment age).
Payment: MockUSDC on Sepolia.

### Step 2: Deploy UserRegistry Proxies

All three deployed via **VerifiableFactory** (`0x10dc6333...`) using
deterministic CREATE2 with `keccak256("UserRegistry", namehash, version)`.

| Registry        | Deployed For             | Address                                                                                        |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `0x9C4e4Ba2...` | `venekovoxv1.eth`        | [Verify](https://sepolia.etherscan.io/address/0x9C4e4Ba2f58DEDd25677cdfaE75A923de0bA9970#code) |
| `0x88191d92...` | `people.venekovoxv1.eth` | [Verify](https://sepolia.etherscan.io/address/0x88191d9203280395cE427f24e207d3D52C93799B#code) |
| `0xE9eE800F...` | `polls.venekovoxv1.eth`  | [Verify](https://sepolia.etherscan.io/address/0xE9eE800F8Dbd6E6Bd7234054516845Af99B7F6F1#code) |

### Step 3: Link Hierarchy

| Action                                                                                | Tx Hash                                                              | Etherscan                                                                                                  |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `eth registry → venekovoxv1 subregistry`                                              | (included in registration)                                           | —                                                                                                          |
| Register `people` on venekovoxv1 registry (with profiles UserRegistry as subregistry) | `0xf97e943dc47ce3df2c51398cb071a928376824c44e9d7510ebb99c7c2376d8f4` | [View](https://sepolia.etherscan.io/tx/0xf97e943dc47ce3df2c51398cb071a928376824c44e9d7510ebb99c7c2376d8f4) |
| Register `polls` on venekovoxv1 registry (with polls UserRegistry as subregistry)     | `0xbdd471aa98ec7aa31ae2e5767af3450ac4af8372ace36954ef4f939157127d55` | [View](https://sepolia.etherscan.io/tx/0xbdd471aa98ec7aa31ae2e5767af3450ac4af8372ace36954ef4f939157127d55) |

### Step 4: Deploy VenekoVoxNames

| Action                           | Tx Hash                                      | Etherscan                                                                                    |
| -------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Deploy `VenekoVoxNames` contract | `0x870A12e8274A165C7bCa64B563aAaeD2655E8369` | [View](https://sepolia.etherscan.io/address/0x870A12e8274A165C7bCa64B563aAaeD2655E8369#code) |

Constructor arguments:

- `profileRegistry`: `0x88191d9203280395cE427f24e207d3D52C93799B`
- `pollRegistry`: `0xE9eE800F8Dbd6E6Bd7234054516845Af99B7F6F1`
- `profileParent`: `people.venekovoxv1.eth`
- `pollParent`: `polls.venekovoxv1.eth`
- `operator`: `0xE13208E10Bb61F663e5A218A9774A99E671eec6D`
- `maci`: `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a`
- `registrationExpiry`: `2104628312` (~2036)

### Step 5: Grant Root Roles

`ROLE_REGISTRAR` (1) + `ROLE_RENEW` (65536) = bitmap `65537` granted to
VenekoVoxNames on both UserRegistries, so the contract can register and renew
names on behalf of users.

---

## Live Verification: Claim a Name

A test name was claimed successfully during deployment:

| Action    | Detail                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| Label     | `testclaim`                                                                                                   |
| Full name | `testclaim.people.venekovoxv1.eth`                                                                            |
| Tx hash   | `0x3f25f4c3b21ae83ffbb48ce359912926db7c244d81e9cde82ddf635b850d8388`                                          |
| Claimer   | `0xE13208E10Bb61F663e5A218A9774A99E671eec6D`                                                                  |
| Etherscan | [View tx](https://sepolia.etherscan.io/tx/0x3f25f4c3b21ae83ffbb48ce359912926db7c244d81e9cde82ddf635b850d8388) |

On-chain verification: calling `profileName(0xE13208E10Bb61F663e5A218A9774A99E671eec6D)`
on the VenekoVoxNames contract returns `testclaim.people.venekovoxv1.eth`.

### How to Verify Yourself

1. Open [VenekoVoxNames on Etherscan](https://sepolia.etherscan.io/address/0x870A12e8274A165C7bCa64B563aAaeD2655E8369#readContract)
2. Call `profileName` with address `0xE13208E10Bb61F663e5A218A9774A99E671eec6D`
3. Expected return: `testclaim.people.venekovoxv1.eth`
4. Call `available("testclaim", false)` — should return `false` (already claimed)
5. Call `available("anynewname", false)` — should return `true`

---

## Source Code

The VenekoVoxNames contract is at
[`packages/contracts/contracts/ens/VenekoVoxNames.sol`](../packages/contracts/contracts/ens/VenekoVoxNames.sol)
in this repository.

Key properties:

- **Sepolia-only**: constructor enforces `block.chainid == 11155111`
- **One claim per account**: `AlreadyNamed()` revert on duplicate
- **Operator-only poll naming**: only the configured operator can name polls
- **ENSIP-15 label validation**: 3–32 chars, lowercase alphanumeric + hyphens
- **Forward resolution verification**: client checks through Universal Resolver
- **No Sybil resistance**: names are public, optional, and unrelated to eligibility
- **Atomic registration**: name + resolver set in one transaction

---

## Tests

| Suite                   | Tests | Status          |
| ----------------------- | ----- | --------------- |
| Contract EVM (ganache)  | 8     | ✅ All pass     |
| Prepare script          | 2     | ✅ All pass     |
| Frontend ENS unit       | 21    | ✅ All pass     |
| Frontend ENS UI (React) | 3     | ✅ All pass     |
| Frontend build          | —     | ✅ Builds clean |

Run locally:

```sh
# Contract tests (needs solc + ganache)
ENS_TOOLCHAIN_PACKAGE_JSON=./test-toolchain/package.json pnpm --dir packages/contracts test:ens

# Frontend tests
pnpm --dir apps/front-end test:ens
pnpm --dir apps/front-end test:ens-ui
```

---

## Related Documentation

- [`docs/ens-registration.md`](ens-registration.md) — Full implementation spec,
  ownership policy, operator setup runbook, and W1 integration gates
- [`docs/status.md`](status.md) — Project-wide deployment status
- [`docs/technology.md`](technology.md) — Technology stack overview
