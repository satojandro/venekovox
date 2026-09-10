# Continuity Demo Poll 1 — France 2027 (Public Manifest)

**Status: LIVE (pending window open at 2026-09-10T00:14Z) · Deployed 2026-09-09 ~23:14 UTC · Operator/deployer: Hermes on behalf of Alejandro, throwaway test wallet per D09**

## Question

_Who do you support for the next French presidential election?_

## Options (voteOptions = 6, 1p1v / MACI FULL mode)

| Index | Option                |
| ----- | --------------------- |
| 0     | Marine Le Pen         |
| 1     | Édouard Philippe      |
| 2     | Jean-Luc Mélenchon    |
| 3     | Jordan Bardella       |
| 4     | Gabriel Attal         |
| 5     | Other / None of these |

Candidate list sourced from Polymarket market odds, 2026-09-09 (top 5 + honest exit). Operator metadata only — MACI does not store question text on-chain.

## Eligibility (who can join)

- **ZKPassport only** (D02 superseded, D17 lock): nationality predicate, age ≥ **18**, **facematch strict**, **salted** uniqueness
- Issuer-signed EIP-712 grant (`SelfEligibilityPolicy`), one grant per poll target, MAX_LIFETIME 15 min
- This is the `C_FR` config from `demo-poll-slate-2026-09-10.md`

> **Eligibility gate note (2026-09-10):** No French passport is available to the operator for
> the live demo scan. Nationality is enforced **issuer-side only** (the ZKPassport query
> allowlist), never on-chain — the deployed policy, configId and poll are nationality-agnostic.
> Demo gate therefore = **Australian passports, 18+** (the operator's available document).
> Switching the gate back to France (or adding any nationality) is one
> `ZKP_NATIONALITY_ALLOWLIST` edit + backend restart; no redeploy. The question remains the
> French election — the product point is that _the same verified-human poll can gate on any
> passport cohort without touching the chain_.

## Chain facts (Sepolia, chainId 11155111) — verified by read-back

| Contract                                   | Address                                      |
| ------------------------------------------ | -------------------------------------------- |
| MACI (existing)                            | `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a` |
| **Poll (pollId 1)**                        | `0x517D42601F3c75DACD2166Af7FC9B8979b0bb709` |
| MessageProcessor                           | `0x93cE1831bDAd32A059fE5a1411cCe1a7c81ef4f3` |
| Tally                                      | `0xaf799426b94aF2ABd3EE1e6b37C88CecEDcD1E50` |
| **SelfEligibilityPolicy**                  | `0x530BDc1fBf343b838D6C5738Caa35bD3985d55Ea` |
| Verifier                                   | `0xb17837f87345ef7dC121a05764Ea061Eb2E7f651` |
| VerifyingKeysRegistry                      | `0xc24a4A4164920bA749262c5AF92533e77F83AfA3` |
| ConstantInitialVoiceCreditProxy (amount 1) | `0xc4aC7aF2aFFfF2748710D9F38611c1357dC4c1e2` |

Poll-0 on this MACI is dead (bad dates, documented) — do not use.

## Window

- `getStartAndEndDate()`: **1788999251 → 1789600451**
- = 2026-09-10 00:14:11 UTC → 2026-09-16 23:14:11 UTC (7 days)

## Policy constructor values (byte-verified against backend)

| Field            | Value                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| owner            | `0xE13208E10Bb61F663e5A218A9774A99E671eec6D`                                                                                                |
| issuer           | `0xE13208E10Bb61F663e5A218A9774A99E671eec6D` (demo: deployer = issuer)                                                                      |
| configId         | `0x5036bfcaeed2c8c7b115a5fb5cee5f5ca0cc2290132024891fe56bf6cb58a1ab` = `keccak256("venekovox-stage1-salted-v1")` ✅ matches `product.ts:69` |
| action           | `keccak256("signup")` ✅ matches `product.ts:70`                                                                                            |
| guarded (target) | `0x517D42601F3c75DACD2166Af7FC9B8979b0bb709` = poll ✅                                                                                      |

## Coordinator

- Public key: `macipk.9a59264310d95cfd8eb7083aebeba221b5c26e77427f12b7c0f50bc1cc35e621`
- Matching secret held offline by operator (never in repo)

## Circuit parameters

- stateTreeDepth 10, messageBatchSize 20, voteOptionTreeDepth 2 → max 25 options (6 used)
- PollJoining/PollJoined zkeys registered on-chain from `zkeys/PollJoining_10_test/` family
- Frontend serves `/zkeys/PollJoining_10_test/…` from `apps/front-end/public/zkeys/`

## Read-back evidence (2026-09-09, publicnode RPC)

```
nextPollId: 2 (poll 1 created)
poll[1]:      0x517D42601F3c75DACD2166Af7FC9B8979b0bb709
msgProcessor: 0x93cE1831bDAd32A059fE5a1411cCe1a7c81ef4f3
tally:        0xaf799426b94aF2ABd3EE1e6b37C88CecEDcD1E50
start: 1788999251 (2026-09-10T00:14:11Z)
end:   1789600451 (2026-09-16T23:14:11Z)
policy on poll: 0x530BDc1fBf343b838D6C5738Caa35bD3985d55Ea  ← NOT FreeForAll
guarded == poll: true
configId match: true   action match: true
```

Deployer gas spend: 0.003242 ETH (balance after: 0.035763 ETH).

## Backend env (live values, secrets NOT committed)

```bash
ZKP_MODE=live
ZKP_DOMAIN=uxisnear.com
ZKP_SCOPE=venekovox-stage1
ZKP_CONFIG_ID=venekovox-stage1-salted-v1
ZKP_NATIONALITY_ALLOWLIST=France
ZKP_LIVE_REQUIRED=1
CHAIN_ID=11155111
POLICY_ADDRESS=0x530BDc1fBf343b838D6C5738Caa35bD3985d55Ea
TARGET_ADDRESS=0x517D42601F3c75DACD2166Af7FC9B8979b0bb709
ISSUER_PRIVATE_KEY=0x...   # deployer key = issuer for demo, operator-only
TAG_SECRET=<64+ hex, offline>
PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

## Frontend env

```bash
VITE_MACI_ADDRESS=0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a
VITE_POLL_ID=1
VITE_CHAIN_ID=11155111
VITE_MACI_START_BLOCK=11567000
VITE_PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
VITE_POLICY_ADDRESS=0x530BDc1fBf343b838D6C5738Caa35bD3985d55Ea
VITE_TARGET_ADDRESS=0x517D42601F3c75DACD2166Af7FC9B8979b0bb709
```

## Known gaps / notes

1. **Issuer = deployer key** for the demo. Product (M2) separates issuer into a backend-held key with policy upgrade via redeploy + `configId` rotation.
2. **Grant issuance is per-poll-target** (policy binds one `guarded`). A voter in 4 polls needs 4 grants; passport scan stays once-per-session (backend session store). Documented UX commitment in slate doc.
3. **Poll deploy config is one-poll-per-run** (single `"Poll"` section per network in `deploy-config.json`). Brazil/Israel/EU polls will each re-run `deploy-poll` after editing this section; `poll-N` keys accumulate correctly in `deployed-contracts.json` (verified: poll-0 and poll-1 coexist).
4. Blocker A (architect's brief) resolved via **preferred option 1**: `SelfEligibilityPolicy` registered in `EContracts`/`EPolicies`/`FULL_POLICY_NAMES` + deploy branch in `02-policies.ts`. FreeForAll fallback is now impossible for this poll (policy pinned on-chain).
5. The deploy log shows `Poll-poll-0` from the dead Aug deployment coexisting — expected, incremental storage.
