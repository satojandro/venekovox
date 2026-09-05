# Reliable vote submission — first P1 implementation

Base reviewed: `32cc13d26b30c8aeaa215f698e185fdfc4907f87`.

## Changes

- Signup, membership recovery/join and publish run as one asynchronous operation. The returned poll state index is passed directly into publish, rather than read from a stale React render.
- The browser SDK entrypoint supplies the WASM join implementation. Vite prebundling matches that entrypoint.
- Empty gate data is `0x`, not the invalid odd-length byte string `0x0`.
- Signup and poll membership are checked on chain each attempt, so a reload or rejected publish does not blindly repeat join transactions.
- Synchronous locks prevent overlapping click handlers and wallet operations. Busy controls cover connection and signup as well as joining and publishing.
- Network is checked before connecting and at flow boundaries. Account/network changes abort subsequent steps and invalidate hook display state. An already-submitted transaction cannot be cancelled by this guard.
- Invalid saved voting keys fail explicitly instead of silently replacing the user's key.
- Confirmation describes message submission and shows its transaction hash. The nonfunctional update-vote control is removed pending properly specified update/nonce semantics.

## Validation

Run from the repository root:

```sh
node --test apps/front-end/tests/voteFlow.test.mjs
```

Or from `apps/front-end`, run `npm run test:vote-flow`.

Eleven tests passed in the implementation environment. Tests execute the actual TypeScript flow with mocked SDK/session dependencies. On Node 20, they use the project's installed TypeScript package to transpile the module. On recent Node they can also use native type stripping. These tests do not verify cryptography, the React DOM, bundling or a live deployment.

Creating the remote branch was rejected by the GitHub integration with HTTP 403 (Resource not accessible by integration). No remote branch or PR was created. This change is delivered as a local commit and Git patch.

The full frontend build was attempted but blocked: workspace dependencies are unavailable (`tsc: not found`). No successful typecheck, Vite build or live-wallet browser smoke test is claimed.

## Required integration check before merge

1. Use the repo-supported Node/pnpm versions and install/build workspace dependencies through the established workflow.
2. Set `VITE_MACI_ADDRESS`, `VITE_CHAIN_ID`, `VITE_POLL_ID` and `VITE_MACI_START_BLOCK` to the confirmed deployment. Set the start block explicitly to avoid an expensive genesis scan. The current subgraph configuration records block 11567000; verify that this covers the required signup/join events for the selected deployment.
3. Run the frontend typecheck/build and the regression command above. Confirm the PollJoining WASM and zkey URLs actually serve the expected artifacts; they were not present in the cloned frontend tree.
4. With a test wallet on the configured testnet, submit a first vote through one click. Reject a signup/join/publish prompt and retry. Reload after joining and confirm no second join transaction is requested. Attempt a wrong-network connection and switch accounts mid-flow.
5. Check the displayed transaction against the selected poll. A successful submission is not proof that a ballot was counted; complete processing/tally validation separately.

## Deliberately remaining P1/M1 work

This is a bounded P1 contribution, not completion of P1 or M1.

- Existing browser-wide MACI key storage is preserved to avoid abandoning registered keys. Account/deployment-scoped key migration, backup and recovery still need design and implementation. Account-change guards do not establish separate voter identities for separate wallets.
- Vote receipts are not persisted across page reloads. Nonce remains 1 for the baseline single-submission demo; supported updates, key changes and cross-device voting are not implemented. Do not treat refresh as an update-vote workflow.
- Self eligibility authorization is still placeholder gate data and requires P2. The page still has mocked eligibility and result data pending P3.
- Final tally/index/UI integration requires P4. A refreshed page recovers membership on the next submission attempt; this patch does not hydrate a complete voter dashboard on page load.
- Poll metadata, timing and option validation against the deployed poll, gas sponsorship, ENS and agent features remain separate work.

The existing implementation agent can continue subgraph/schema work without changing these frontend flow files. Merge only after the integration checks above; coordinate before parallel edits to the same files.
