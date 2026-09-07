# ENS naming deployment handoff

**Created:** 2026-09-07. **Owner at time of writing:** Hermes (crypto-builder).
**Status:** parents registered; registries and registrar **not yet deployed**.

This is the pickup document for anyone — human or agent — continuing ENS naming work.
It records decisions made with Alejandro and live chain state that is easy to
re-derive badly. Read it before touching ENS code or signing anything.

Source of truth for code-level detail: [ens-registration.md](ens-registration.md)
(Astra's candidate design). This file adds **deployment decisions and verified
chain state** only.

---

## 1. Namespace decision (settled 2026-09-07)

Two **independent** parent trees, not one parent with sub-layers:

```
RootRegistry 0x8115186e8f2e0b0281e86ab91f0f48ba90364354
  └─ getSubregistry("eth") → ETHRegistry 0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2
       ├─ getSubregistry("venekovox") → UserRegistry A
       │     └─ alice.venekovox.eth        PROFILES (user-minted)
       └─ getSubregistry("openpoll")  → UserRegistry B
             └─ poll-42.openpoll.eth       POLLS (operator-only)
```

- `profileParent = "venekovox.eth"`
- `pollParent    = "openpoll.eth"`

**Do not build `people.<parent>.eth` or `polls.<parent>.eth`.** An earlier plan used
those intermediate layers. With two registered parents they are unnecessary, and each
would add its own expiry that can silently kill the subtree. This supersedes the
`people`/`polls` wording in Astra's `ens-registration.md`.

Rationale: separate expiries and separate admin control per tree; one tree failing
does not take the other.

## 2. Verified chain state (Sepolia, block 11656196)

| Name            | Status     | Expiry                  | Namehash                                                             |
| --------------- | ---------- | ----------------------- | -------------------------------------------------------------------- |
| `venekovox.eth` | REGISTERED | 1883503500 (2029-09-07) | `0x46edca5b8792629baa7fcd3c924c64a496d02d4bcbe32d16dc35e31c33c15d36` |
| `openpoll.eth`  | REGISTERED | 1820366484 (2027-09-08) | `0xe97088301a57ae1b7b1d814837af0ebc189b9a2703009eb43f98a4d3b842ac69` |

Both resolve through the Universal Resolver to the owner address. Neither has a
subregistry yet — that is the next build step.

### Expiry constraint (easy to get wrong)

A subname whose parent lapses **stops resolving** even while the leaf token is still
live. The two parents expire on **different dates**, so the binding constraint is the
**shorter** one:

> Registrar `registrationExpiry` must be ≤ **1820366484** (`openpoll.eth`).

Do not pick a round number like "one year from deployment".

## 3. Addresses

| Role                      | Address                                      | Notes                                                                           |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Human owner (Alejandro)   | `0xEA3e3612175a894362f3062785adC133D9b98f10` | Owns both parents. Signs role grants.                                           |
| Agent operator (deployer) | `0xE13208E10Bb61F663e5A218A9774A99E671eec6D` | Testnet-only key at `packages/contracts/.deployer-key` (gitignored, untracked). |

### Verified ENSv2 Sepolia Beta contracts

| Contract                 | Address                                      |
| ------------------------ | -------------------------------------------- |
| VerifiableFactory        | `0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef` |
| UserRegistryImpl         | `0x624a25d67B59D587752EbEc8DdeD8827dAe52050` |
| PermissionedResolverImpl | `0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e` |
| ETHRegistry              | `0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2` |
| RootRegistry             | `0x8115186e8f2e0b0281e86ab91f0f48ba90364354` |
| UniversalResolver        | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |

These are **Beta** addresses and may change. Re-verify against
[deployments](https://docs.ens.domains/learn/deployments/) before use.

## 4. Deployment procedure

Alejandro signs; the agent executes. No agent holds owner keys.

1. **Alejandro** grants `ROLE_SET_SUBREGISTRY` on both parents to the deployer:
   `ETHRegistry.grantRoles(resource, 1 << 20, deployer)` — one transaction per parent.
   _Grant the role; do not transfer the names._ See §6.
2. Deploy UserRegistry `A` (for `venekovox.eth`) and `B` (for `openpoll.eth`) via
   VerifiableFactory:
   ```
   salt     = keccak256(abi.encode(keccak256("UserRegistry"), namehash(name), 0))
   initData = initialize(rootAccount = OWNER, roleBitmap = ALL_ROLES)
   deployProxy(UserRegistryImpl, salt, initData)
   ```
   `ALL_ROLES = 0x1111111111111111111111111111111111111111111111111111111111111111`
   — already includes `ROLE_REGISTRAR_ADMIN` and `ROLE_RENEW_ADMIN`. Verified.
3. `ETHRegistry.setSubregistry(tokenId(parent), registry)` for each.
4. Deploy `VenekoVoxNames` with `profileRegistry=A`, `pollRegistry=B`,
   `profileParent="venekovox.eth"`, `pollParent="openpoll.eth"`, both namehashes,
   `admin`, `maci`, `expiry ≤ 1820366484`.
5. **Alejandro** grants `A.grantRootRoles(65537, registrar)` and
   `B.grantRootRoles(65537, registrar)`.
   `65537 = ROLE_REGISTRAR (1<<0) | ROLE_RENEW (1<<16)` — registrar + renew, nothing else.
6. Set frontend env: `VITE_ENS_REGISTRAR`, `VITE_ENS_RPC_URL`, `VITE_MACI_ADDRESS`.
7. Claim a throwaway name; verify event, forward resolution and reconnect.

Steps 1, 3 and 5 were dry-run successfully at block ~11656200. Gas is Alejandro's.

## 5. Why names are non-transferable

This is **absence of a role, not a check in our code**.

`VenekoVoxNames` calls `registry.register(..., roleBitmap = 0)`. A zero bitmap means
the owner receives **no roles at all**, so no code path exists for them to transfer,
rename, re-point or delegate their name. We likewise never grant `ROLE_UNREGISTER`
or `ROLE_CAN_TRANSFER_ADMIN` to anyone.

Do not "fix" a user complaint about not being able to transfer a name by granting
roles — that silently removes the core product guarantee. Escalate instead.

## 6. Grant roles, don't transfer the names

Alejandro proposed transferring both ENS names to the deployer. **Decided against it.**

- `ROLE_SET_SUBREGISTRY` is the _only_ power the deployer needs.
- Transferring the ERC-1155 moves the whole role set, including
  `ROLE_CAN_TRANSFER_ADMIN` — the key could then transfer the names away.
- It would move the demo namespace out of Alejandro's control, which is a bad look
  for a project about uncoercible civic tooling.
- It wouldn't even help: the owner does **not** hold `ROLE_REGISTRAR_ADMIN` or
  `ROLE_RENEW_ADMIN`, so transferring wouldn't enable granting `65537` either.

Least privilege here matches the design of `VenekoVoxNames` itself.

## 7. Open gaps

- **Privy is not wired to naming.** The `/names` page uses an injected wallet, so
  users pay their own Sepolia gas. The adapter interface (`NamingWallet`) is a
  drop-in, but W1's sponsorship allowlist does not cover naming yet.
- **Named voting is not real yet.** `PollDetail` still uses mock question/options/
  results. An ENS-resolved poll opens checked discovery, not a voting experience.
  Requires S3.2 metadata binding first.
- **No recovery path.** After expiry, revocation or wallet loss there is no
  replacement claim or account migration. Deliberate, but it is a product gap.
- **Sepolia Beta resets periodically.** Names may vanish. Re-probe before demos.

## 8. Probe scripts

In `~/Hermes-crypto-builder/p2-toolchain/scratch/` (Mac Mini, not in this repo):

| Script                        | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `probe-ens.mjs <names...>`    | Hierarchy walk + owner/status/expiry/subregistry/resolver |
| `debug-state.mjs`             | Raw `getState` + Universal Resolver round trip            |
| `roles.mjs` / `grantable.mjs` | Role bitmap decode + `hasRoles` checks                    |
| `sim-full.mjs`                | Dry-run `deployProxy` + `setSubregistry`                  |

All read `ALCHEMY_API_KEY` from env, send nothing, need no signer.

### Gotchas that cost real time

- **`getState` takes a LABELHASH (`keccak256(bytes(label))`), not a namehash.**
  Passing a namehash silently returns `AVAILABLE` for a registered name.
- **`expiry` can be `uint64` max.** `Number()` throws `RangeError: Invalid time value`.
- `nick.eth` — the ENS docs' canonical example — does **not** resolve on Sepolia Beta.
  Don't use it as a reference.
- Don't invent contract addresses to test with; look them up on the deployments page.

## 9. Key hygiene

`packages/contracts/.deployer-key` is gitignored (`.gitignore:167`) and untracked.
Testnet only. Never commit it. Never reuse the key on mainnet.
