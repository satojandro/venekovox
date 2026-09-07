# ENS registration candidate — S1.1, 2026-09-07

This is the second patch above the merged discovery implementation, based on main
`81950b42`. Owner: Astra. Working branch: `codex/ens-registration-v2`.
It implements registration and recovery locally; it is **not deployed or live-verified**.

## Implemented scope

- `/names` offers optional account naming with explicit consent to public address
  linkage. The default connection is an injected, user-funded Sepolia wallet.
- `VenekoVoxNames.claimProfile(label)` assigns the ENSv2 registry token to
  `msg.sender`, including a contract account, and installs its address record in the
  same transaction. One claim per account per registrar deployment; not one per human.
- `profileName(account)` provides application-scoped reconnect recovery without an
  indexer, browser cache or global reverse-name write. The client checks fresh forward
  resolution through the Universal Resolver before displaying the recovered name.
- The immutable operator calls `namePoll(label,pollId)`. The contract derives the
  Poll from its immutable MACI deployment, requires deployed code, registers a name
  owned by the calling operator, and constructs `xyz.venekovox.poll` atomically.
  The client reuses the first patch's MACI/Poll/schedule validation after confirmation.
- Successful receipt status alone is insufficient: the client also requires the
  registrar's matching event and fresh name resolution. Account/chain changes,
  page departure, failures and timeouts cannot produce success for a different context.
  The UI guards same-tick duplicate submits. It never retries a transaction automatically.

Source: [contract](../packages/contracts/contracts/ens/VenekoVoxNames.sol),
[client](../apps/front-end/src/ens/registration.ts),
[page](../apps/front-end/src/pages/Names.tsx),
[injected adapter](../apps/front-end/src/ens/injectedNamingWallet.ts).

## Candidate namespace and ownership policy

Use two dedicated ENSv2 UserRegistries linked below an operator-controlled parent:
`<label>.people.<parent>.eth` and `<label>.polls.<parent>.eth` are **examples**, not
registered names. Separation prevents public profile claims from occupying poll labels.
The actual parent name has been requested from Alejandro and is still unspecified.

The candidate accepts a normalized ASCII subset: 3–32 lowercase letters, digits and
hyphens, no leading/trailing hyphen and no third/fourth-position double hyphen.
The latter is ENSIP-15's reserved label extension rule. The client additionally uses
ethers ENS normalization. Unicode profiles and renaming are outside this patch.

Each name is minted with an owner role bitmap of zero. This registrar provides no
transfer, resolver editing, role delegation, unregister or renewal entry point. Its
narrow custom resolver implements ETH address and text reads; it does not write to an
ENS shared/per-account PermissionedResolver. This avoids granting participants write
permissions over the parent's resolver and makes initial records atomic.

**This does not establish permanent or absolutely nontransferable names.** ENSv2 root
roles, registry upgrades, ancestor expiry and ancestor pointer changes remain under
the parent administrators' control. An explicitly chosen absolute registration expiry
is mandatory at deployment; no silent one-year or no-expiry default is selected.
Parent names may expire sooner. D04's desired permanent/nontransferable semantics
remain unresolved until the complete hierarchy, root roles and recovery policy are reviewed.

Records are served only while the original ENS resource remains registered, unexpired,
owned by the original account and pointed at this resolver. Role changes can regenerate
token IDs, so resource identity is checked instead of caching a token ID. Re-registration
must not revive records from an old registration. This registrar never reuses a previously
claimed label, even if a parent administrator unregisters it. After expiry, revocation or
wallet loss, this candidate does not provide a replacement claim or an account migration.

Self eligibility, nullifiers, document data and MACI secrets never enter naming records.
Recovering a wallet can restore its active public name; it does not restore MACI keys or
establish eligibility. Name ownership is not proof of poll authorship or human uniqueness.
Claims have no registrar fee, but still consume gas and have no Sybil-resistant quota.

## ENSv2 write-path sources

Official documentation and source inspected on 2026-09-07:

- [Building with AI](https://docs.ens.domains/building-with-ai/) explains documentation
  resources and optional MCP integrations; none grants repository write permission.
- [Contract developer guide](https://docs.ens.domains/ensv2/tutorial-contract-developers/):
  separate registrar/registry roles and `register` with an owner, resolver, role bitmap
  and absolute expiry; custom resolvers are supported.
- [Permissioned Registry](https://docs.ens.domains/ensv2/permissioned-registry/):
  root powers, registration states, resource versions and transfer permissions.
- [App developer guide](https://docs.ens.domains/ensv2/tutorial-app-developers/):
  subname ownership is distinct from resolver write permission; forward checks are needed.
- [Deployments](https://docs.ens.domains/learn/deployments/): Sepolia Beta RootRegistry
  `0x8115186e8f2e0b0281e86ab91f0f48ba90364354` and canonical Universal Resolver
  `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`.
- Minimal ABI reconciled with upstream
  [IPermissionedRegistry](https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/interfaces/IPermissionedRegistry.sol),
  [IStandardRegistry](https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/interfaces/IStandardRegistry.sol)
  and [IRegistry](https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/interfaces/IRegistry.sol).
  These are moving Beta sources, not a vendored/pinned upstream implementation.
  Recheck the selected deployment ABI and implementation revision before deploying.

The registrar/resolver is new VenekoVox code using the documented ENSv2 interface;
it is not the upstream ENS registrar or an audited ENS contract. Local EVM tests use an
ABI-shaped registry double, **not real ENSv2 permission, ERC1155 or hierarchy execution**.

## Operator setup and signing boundary

Alejandro owns the funded accounts and signs privately. No agent has registered a name,
deployed a contract, granted a role, or sent a public-network transaction in this task.

1. Choose/control a native Sepolia ENSv2 parent and record its registration and expiry.
   Create and link dedicated participant/poll UserRegistries using the official factory
   and ENS App. Review retained root roles and upgrades; do not assume an existing
   mainnet/v1 name or a successful mirrored lookup is an ENSv2 parent setup.
2. Approve the candidate ownership/recovery/expiry policy above. Select the actual MACI
   deployment and operator account. Record all ancestor expiries and registry pointers.
3. Prepare a **public** JSON file with `profileRegistry`, `pollRegistry`, `profileParent`,
   `pollParent`, `operator`, `maci` and `registrationExpiry` (an absolute Unix timestamp
   **string**). Do not put private keys, documents or RPC credentials in that file.
4. Run the read-only preparation command from `packages/contracts`, with an existing
   private-shell `ENS_RPC_URL` setting:

   ```sh
   pnpm prepare:ens /absolute/path/public-naming-config.json
   ```

   [prepareEnsRegistration.mjs](../packages/contracts/scripts/prepareEnsRegistration.mjs)
   validates the shape, chain, deployed code, future expiry and ENS hierarchy at a block
   snapshot. It prints constructor arguments, with both parent namehashes computed, and
   the checked block. It never constructs a signer or sends transactions. It does not
   certify ownership, retained roles or production safety.

5. Deploy `VenekoVoxNames` with those arguments through Alejandro's wallet tooling.
   Verify the deployed source. Add its public `registrar` address to the same file and
   rerun preparation to obtain unsigned role-grant calldata for both registries:
   `grantRootRoles(65537, registrar)` (registrar + renew for available expired entries).
   Sign with an account holding the required admin roles. Do not grant these root powers
   to arbitrary accounts or grant transfer/admin/upgrade powers to this registrar.
6. Confirm roles and actual parent pointers on chain. Configure public frontend
   `VITE_ENS_REGISTRAR`, `VITE_ENS_RPC_URL` and `VITE_MACI_ADDRESS`. No signer secret goes
   into Vite. `/names` checks the actual hierarchy before making a claim.
7. Claim a disposable test profile; confirm registry ownership, event and Universal
   Resolver address. Reconnect in a fresh session. Exercise rejection, collision,
   account/network switch and resolver failure. Name a real poll as the operator, open
   its `/p/:name` link and check the target independently. Record public tx/block links.

## W1 and voting integration gates

`NamingWallet` reuses W1's `peek` and subscription concepts. Its `send` must execute as
the **participating account**, and return an actual chain transaction hash. Adapt W1's
`SponsoredHandle` through its confirmed vendor path; never return its transaction ID or
user-operation hash as a chain hash. Receipt verification works for an outer bundle by
requiring the registrar event and final state instead of assuming `receipt.from` is the
participant. Persist vendor handles in W1 before waiting for inclusion.

The page accepts a supplied adapter, but **Privy is not imported or mounted here**.
W1 must extend its sponsorship allowlist to this reviewed registrar/method set, define
fees/quotas and handle missing sponsorship explicitly. Its MACI/Poll-only policy cannot
be assumed to sponsor names. Preserve its injected fallback and E1–E6 gates. Mount the
optional name step in W1 onboarding once its actual account interface is integrated.

Poll-name links currently open checked discovery. They do not yet open a real voting
experience: `PollDetail` still uses mock question/options/results and `useMaci` captures
an environment-configured poll. Safely wiring arbitrary resolved references requires
S3.2 metadata binding and the voting route to consume that same target, plus W1/P2
eligibility integration. No ENS link is redirected into that mock route by this patch.

## Reproduced local evidence

Node 22.20.0, pnpm 10.34.5. Frozen workspace installation succeeded with `--ignore-scripts`
and no lock changes. The scripts were then invoked explicitly for the local MACI build.

- Frontend `test:unit`: **73 tests** (52 previous non-ENS + 21 ENS); see status for final run.
- Frontend `test:ens-ui`: **3 jsdom/React tests**, covering delayed recovery after
  account switch, public-link consent/same-tick duplicate submits, and missing config.
- Contracts `test:ens`: **10 tests** (8 local EVM + 2 unsigned-plan validation).
  The EVM suite uses solc 0.8.28, Ganache 7.9.2 and ethers 6.15.0 through the existing
  isolated test toolchain, selected with `ENS_TOOLCHAIN_PACKAGE_JSON`. Ganache uses its
  JS fallback on this Mac. This is synthetic execution, not Sepolia evidence.
- `pnpm --filter '@maci-protocol/sdk...' build` and frontend `build` succeeded.
  Frontend still warns that existing SDK browser exports `getSignedupUserData` and
  `getJoinedUserData` are missing, alongside Lottie `eval` and bundle-size warnings.
  Build success is not a working-voting claim. Upstream compilation reports warnings.
- Focused strict ENS TypeScript and frontend ESLint checks passed. Formatting checked
  on touched files. Solidity lint has pre-existing-rule/NatSpec/gas-style warnings;
  these are not an audit.

Typical commands (use the repository Node 22 / pnpm 9 or 10 toolchain):

```sh
pnpm --dir apps/front-end test:unit
pnpm --dir apps/front-end test:ens-ui
ENS_TOOLCHAIN_PACKAGE_JSON=/absolute/path/test-toolchain/package.json pnpm --dir packages/contracts test:ens
pnpm --dir apps/front-end build
```

Live ENSv2 registry compatibility, CCIP/Universal Resolver round trip, native-wallet
browser signing, Privy sponsorship/onboarding, and real named voting remain unverified.
