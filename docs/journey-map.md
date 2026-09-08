# VenekoVox technical journey map

## P2 Enterprise candidate overlay — 2026-09-05

The legacy call map below remains historical/as-built for the existing UI. **New identity
work uses Self Enterprise (D02); do not copy the Pass QR/verifier path into new code.**
This patch adds unmounted modules on main `c12361c3ac2797f98e1238cdca669227fc43ebcc`.
It does not claim the old browser flow now invokes them.

| Step | Actual candidate symbol                                            | Input → output / boundary                                                                    |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1    | `EnterpriseEligibility.createChallenge`                            | Participating account → short-lived signed-message challenge                                 |
| 2    | `EnterpriseEligibility.begin`                                      | Wallet signature → server-created hosted session; account control checked before API request |
| 3    | `enterpriseTransport.verifyWebhook`                                | Raw bytes + delivery headers → official SDK-authenticated event                              |
| 4    | `EnterpriseEligibility.receiveWebhook`                             | Session/version/environment/rules validation → minimized internal claims                     |
| 5    | `EnterpriseEligibility.authorize` → `EligibilityService.authorize` | Repeat wallet-control check → scoped signed EIP-712 evidence                                 |
| 6    | `SelfEligibilityPolicy.enforce`                                    | Actual MACI/Poll caller + evidence → atomic one-use authorization                            |

Source: [Enterprise coordinator](../apps/backend/src/eligibility/enterprise.ts),
[SDK boundary](../apps/backend/src/eligibility/enterpriseSdk.mts),
[authorization](../apps/backend/src/eligibility/authorization.ts),
[policy](../packages/contracts/contracts/eligibility/SelfEligibilityPolicy.sol).
Line numbers will move with formatting; these exact symbols are the trace anchors.

Missing edges: HTTP routes and durable session/inbox storage; hosted-page UI and status
recovery; W1 signup/join evidence injection; actual MACI/Poll deployment and live Self
verification. The Graph and ENS gain no new identity data from this patch. See
[build.md A1](build.md) for trust, privacy, deployment and testing details.

**Purpose:** a call-by-call ASCII map of what each technology does and when it enters.
Every function name below was read from source in this repository, not from memory.

**Read this first, then any other doc.** If a claim here disagrees with another doc,
this file is wrong or stale — fix it here.

Code snapshot: `05d8f2a35`; documentation reviewed against main `d75b472`
(2026-09-05). Chain configuration: Sepolia `11155111`. This is not live
deployment evidence. See [branch and deployment status](status.md#branch-and-deployment-status).
MACI `0x44F31f3823ceFE00C2FA5acEB2576F119143Fe3a` · Poll-0 `0x29D39dD442c91…c22CB`.

---

## 0. Legend

```
  [OK]   code exists, has evidence
  [GAP]  code exists but a link is missing
  [NONE] no code in the repo
  [PLAN] designed, NOT built — do not cite as working
  ~~~~>  the missing link
```

Four colours of truth:

| Marker   | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| `[OK]`   | source exists; tests or a commit back it                |
| `[GAP]`  | source exists, but the next hop in the journey does not |
| `[NONE]` | nothing in this repository — planned only               |
| `[PLAN]` | a designed future path; **never** implied to work       |

**Rule:** this document describes the code as it is. It never describes the code as
it will be. Future work appears only as `[NONE]`, `[GAP]`, `[PLAN]` or `~~~~>`.
If a function name cannot be verified against a file in this repository or a
primary source, it does not belong in this document.

---

## 1. The whole system, one page

```
 STAGE       1 UNDERSTAND     2 PROVE ELIGIBLE   3 VOTE            4 COUNT          5 INSPECT
             ---------------  -----------------  ----------------  ---------------  ---------------
 USER SEES   "what am I       "scan your         "pick an option,  (nothing —       "what did
             voting on?"       passport"          submit"           off-chain)       people say?"

             ┌────────────┐   ┌────────────┐     ┌────────────┐    ┌────────────┐   ┌────────────┐
 TECH        │ React UI   │   │ Self.xyz   │     │ MACI       │    │ Tally.sol  │   │ The Graph  │
             │ PollDetail │   │ + backend  │     │ Poll.sol   │    │ + zk proof │   │ subgraph   │
             └────────────┘   └────────────┘     └────────────┘    └────────────┘   └────────────┘
                  [OK]             [GAP]              [OK]              [OK]*            [GAP]
                                     │                  │                 │                 ▲
                                     │ ~~~~~~>          │                 │  NO EVENTS      │
                                     │ no contract      │                 │ ~~~~~~~~~~~~~~> │
                                     │ bridge (G01)     │                 │  missing path   │
                                     │                  │                 │  results (G06)  │
                                     │                  │                 │                 │
                                     │                  └── events ───────┼────[OK]─────────┘
                                     │                     SignUp         │   indexes votes
                                     │                     DeployPoll     │   as CIPHERTEXT
                                     │                     PollJoined     │   + turnout
                                     │                     PublishMessage │
                                     │                     MergeState     │
                                     │                                    │
             ┌────────────┐          │                                    │
 EXTRA       │ ENS        │ [NONE]   │                                    │
             └────────────┘          │                                    │
                                     │                                    │
             ┌────────────┐          │                                    │
             │ Privy/7702 │ [NONE]───┘ (would change which address calls)
             └────────────┘

 * Tally.sol exists and verifies proofs. It is NOT connected to stage 5.
```

**The single most important line on this page:** stage 4 → stage 5 is severed.
There is no implemented tally-result ingestion path. Missing dedicated tally
events explain the current event-driven gap, not a limitation on all Graph
indexing strategies. Eligibility and browser proving assets are also blockers.

---

## 2. Stage 3 — the vote, call by call

This stage has an orchestrated code path; browser proving and live acceptance remain open. Entry: `apps/front-end/src/hooks/voteFlow.ts`.

```
  User clicks "Submit"
        │
        ▼
  ┌───────────────────────────────────────────────────────────────────────┐
  │ createVoteFlow({ sdk, getSession, getConfig, onProgress, onReceipt })  │
  │   voteFlow.ts:49                                                       │
  │   captures { chainId, maciAddress, pollId, account } ONCE (snapshot)   │
  │   every later step calls assertCurrent() to re-validate it             │
  └───────────────────────────────────────────────────────────────────────┘
        │
        ├─ STEP 1 ── am I registered? ────────────────────────────────────┐
        │   sdk.getSignedupUserData(signupArgs)              voteFlow.ts:78│
        │     └─> MACIFactory.connect(maciAddress, signer)   user/signup.ts:19
        │         reads MACI state tree
        │                                                                  │
        │   if NOT registered:                                             │
        │   sdk.signup({ ..., sgData: "0x" })                voteFlow.ts:83│
        │     └─> maciContract.signUp(userMaciPublicKey.asContractParam(), │
        │                             sgData)              user/signup.ts:72
        │         ── ON-CHAIN TX ──> emits  SignUp(stateIndex, timestamp,  │
        │                                           pubKeyX, pubKeyY)      │
        │                                                    MACI.sol:67   │
        └──────────────────────────────────────────────────────────────────┘
        │
        ├─ STEP 2 ── am I joined to THIS poll? ───────────────────────────┐
        │   sdk.getJoinedUserData({...})                    voteFlow.ts:91 │
        │                                                                  │
        │   if NOT joined:                                                 │
        │   sdk.joinPoll({...})                             voteFlow.ts:102│
        │     │                                                            │
        │     ├─> contractExists(provider, maciAddress)   user/joinPoll.ts:36
        │     ├─> hasUserJoinedPoll({...})                              :55│
        │     ├─> maciContract.getPoll(pollId)                          :67│
        │     │      returns (poll, messageProcessor, tally)   MACI.sol:210│
        │     ├─> maciContract.getStateIndex(pubKey.hash())             :71│
        │     ├─> generateAndVerifyProof(circuitInputs, pollJoiningZkey) :98│
        │     │      ── ZK PROOF IN BROWSER ──  proves "I am in the       │
        │     │         signup tree" WITHOUT revealing WHICH leaf         │
        │     │         needs /zkeys/PollJoining_10_test/  [GAP G08 —     │
        │     │         assets not in apps/front-end/public]              │
        │     └─> pollContract.joinPoll(                                :108│
        │             nullifier,                                           │
        │             userMaciPublicKey.asContractParam(),                 │
        │             currentStateRootIndex,                               │
        │             proof, sgDataArg, ivcpDataArg)                       │
        │         ── ON-CHAIN TX ──> Poll.sol:361                          │
        │         emits  PollJoined(...)                       Poll.sol:126 │
        └──────────────────────────────────────────────────────────────────┘
        │
        └─ STEP 3 ── publish the encrypted vote ──────────────────────────┐
            sdk.publish({...})                             voteFlow.ts:119 │
              │                                                            │
              ├─> getPollContracts({ maciAddress, pollId, signer })        │
              │                                          vote/publish.ts:36│
              ├─> Promise.all([ pollContract.voteOptions(),                │
              │                  pollContract.getAddress() ])           :41│
              ├─> getCoordinatorPublicKey(pollAddress, signer)          :42│
              ├─> generateVote({ pollId, voteOptionIndex, salt, nonce,     │
              │      privateKey, stateIndex, voteWeight,                   │
              │      coordinatorPublicKey, maxVoteOption, newPublicKey }):44│
              │      ── ENCRYPTION ──  ECDH shared secret between a fresh  │
              │         ephemeral private key and coordinator public key →       │
              │         the ballot is encrypted to the coordinator         │
              │                                                            │
              └─> submitVote({ pollAddress, vote, signer })  vote/submit.ts:10
                    │  const pollContract = PollFactory.connect(pollAddress, signer)
                    └─> pollContract.publishMessage(
                              vote.message,                     submit.ts:13
                              vote.ephemeralKeypair.publicKey.asContractParam())
                        ── ON-CHAIN TX ──> Poll.sol:265
                        emits  PublishMessage(Message, PublicKey)  Poll.sol:124

            ⚠️  RECIPIENT IS THE **POLL**, NOT MACI.  (this is the bug that
                was fixed at 2ee992a43 / f81f1b8e0 — see §6)
```

### What stage 3 does and does not give you

| Question                            | Answer                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| Is the ballot encrypted?            | Yes — to the coordinator's public key                                                  |
| Is it on-chain?                     | Yes — `Poll.publishMessage`                                                            |
| Is it anonymous to the coordinator? | **No.** Coordinator holds the decryption key                                           |
| Is it counted?                      | **No.** Counting is stage 4                                                            |
| Is participation unlinkable?        | No: signup/join reuse a public key; transactions and registration relations are public |

---

## 3. Stage 5 — where The Graph enters (and where it stops)

The current subgraph uses event triggers and contract reads. For example,
`handleDeployPoll` reads MACI and Poll state. There is no application push to
The Graph. Call/block handlers are other possible triggers, subject to network
and indexer support; they are not implemented for tally results here.

```
  Sepolia chain                          Graph Node                    schema.v1.graphql
  ═════════════                          ══════════                    ═════════════════

  MACI.sol
    ├─ emit DeployPoll(...)    ────────> handleDeployPoll   maci.ts:12 ──> Poll
    │                                     │                                 .pollId
    │                                     ├─ MaciContract.bind(maci.id)      .startDate
    │                                     ├─ .getPoll(id)                    .endDate
    │                                     ├─ pollContract.voteOptions()      .voteOptions
    │                                     ├─ pollContract.treeDepths()       .treeDepth
    │                                     ├─ .getStartAndEndDate()           .duration
    │                                     ├─ poll.tally = contracts.tally  ◄─┐ stores the
    │                                     │                                  │ ADDRESS,
    │                                     │                                  │ never reads
    │                                     └─ PollTemplate.create(poll.id)     │ it
    │                                          ^^^^ dynamic datasource:      │
    │                                          the Poll is now indexed       │
    │                                                                        │
    └─ emit SignUp(...)        ────────> handleSignUp       maci.ts:57 ──> User
                                                                            Account
                                                                            StateLeaf

  Poll.sol   (via PollTemplate)
    ├─ emit PollJoined(...)    ────────> handlePollJoined   poll.ts:121 ─> Registration
    │                                     │                                 +
    │                                     └─ poll.registrationCount++       Poll
    │                                          ^^^^ THIS IS THE JOIN COUNT      .registrationCount
    │                                               METRIC — auditable;
    │                                               public-key linked
    │
    ├─ emit PublishMessage(...)────────> handlePublishMessage poll.ts:38 ─> Vote
    │                                     │                                  .data  [BigInt!]!
    │                                     │                                  ── uint256[10]
    │                                     │                                  CIPHERTEXT
    │                                     └─ poll.numMessages++              Poll.numMessages
    │
    ├─ emit MergeState(...)    ────────> handleMergeState   poll.ts:19  ──> Poll.stateRoot
    ├─ emit ChainHashUpdated(.)────────> handleChainHashUpdate poll.ts:60 ─> ChainHash
    └─ emit IpfsHashAdded(...) ────────> handleIpfsHashAdded   poll.ts:74

  Tally.sol
    └─ emit *** NOTHING ***            ✗ NO HANDLER                    ✗ NO RESULT ENTITY
       (grep: zero `event` in
        Tally.sol and ITally.sol)         THE SEVERED LINK (G06)
```

### The Graph's three hard limits

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. `Vote` is an ENCRYPTED MESSAGE, not a counted ballot.               │
  │    schema: `data: [BigInt!]!  # uint256[10]`                           │
  │    The Graph literally cannot read the choice. Neither can anyone      │
  │    except the coordinator.                                             │
  │                                                                        │
  │ 2. NO RESULTS. No tally-result handler → this subgraph indexes nothing   │
  │    about outcomes. `poll.tally` is stored as an address and never      │
  │    read. There is no `Tally` datasource in templates/*.yaml.           │
  │                                                                        │
  │ 3. `registrationCount` counts REGISTRATIONS, not unique humans.        │
  │    Self proof → contract bridge does not exist (G01), so two wallets   │
  │    = two registrations.                                                │
  └────────────────────────────────────────────────────────────────────────┘
```

### Queries supported by the source model (live evidence pending)

```
  Q: how many registrations for poll X?     A: Poll.registrationCount   [OK] source
  Q: how many encrypted messages?       A: Poll.numMessages         [OK] source
  Q: when does the poll close?          A: Poll.startDate/endDate   [OK] source
  Q: what were the results?             A: ✗ NOT IMPLEMENTED       [GAP G06]
```

The proposed Graph pitch is **auditable participation counts and encrypted
ballot choices, with explicit privacy and finality semantics**. Registrations
are linked to public keys; counts are not proof of unique people or counted
voters. A live claim requires deployment and query evidence in status.md.

---

## 4. Stage 2 — Self eligibility, and the missing bridge

```
  ┌──────────────┐
  │ React UI     │  Auth.tsx — shows a QR code
  └──────┬───────┘
         │  user scans with the Self mobile app
         ▼
  ┌──────────────┐
  │ Self mobile  │  proves from a real passport (NFC chip)
  │ app          │  produces ZK proof + publicSignals
  └──────┬───────┘
         │  POST /verify
         ▼
  ┌────────────────────────────────────────────────────────────────┐
  │ apps/backend/src/routes/verify.ts                              │
  │                                                                │
  │   selfBackendVerifier = new SelfBackendVerifier(               │
  │        scope, endpoint, ... )                          :17     │
  │                                                                │
  │   result = await selfBackendVerifier.verify(                   │
  │        attestationId, proof, publicSignals,           :43     │
  │        userContextData )                                       │
  │                                                                │
  │   result.discloseOutput.nullifier    ── uniqueness signal      │
  │   result.discloseOutput.nationality  ── logged ⚠️ G09          │
  │   result.discloseOutput.gender       ── returned ⚠️ G09        │
  └────────────────────────────────────────────────────────────────┘
         │
         │  200 OK
         ▼
  ┌──────────────┐
  │ browser flag │  localStorage "venekovox_verified" = "true"
  └──────┬───────┘
         │
         │  ~~~~~~~~~~~~~~~~~~~~ GAP G01 ~~~~~~~~~~~~~~~~~~~~
         │  NOTHING reaches the chain.
         │  MACI.signUp(_publicKey, _signUpPolicyData) is called
         │  with sgData = "0x"  (voteFlow.ts:83) — empty policy data.
         │  Configured policy is FreeForAll: no Self gate.
         X
  ┌──────────────┐
  │ MACI policy  │  ← should reject unverified wallets here
  └──────────────┘
```

**The one-line version:** Self verification does not authorize contract participation in this flow.
The configured FreeForAll policy does not enforce Self eligibility. Actual
submission still requires an open poll, membership and working proving assets;
the recorded Poll-0 configuration is not currently votable.

---

## 5. Stage 1 — ENS: nothing exists yet

```
  grep -rni "ens" apps/front-end/src apps/backend/src
                  apps/subgraph/src packages/contracts/contracts
      → zero matches (excluding "ensure", "Spanish", etc.)

  ┌──────────────┐
  │ ENS          │  [NONE] — no code, no registration, no resolution
  └──────────────┘
```

Planned role, when built:

```
  participating account (0x1234…)
        │
        │  reverse resolve
        ▼
  alejandro.venekovox.eth          ← display name instead of 0x1234…
        │
        ├─ forward resolve must MATCH reverse resolve (else: show address)
        ├─ no name?                → fall back to truncated address
        └─ successful name         → NEVER grants eligibility (Self does that)
```

ENS is a **naming layer on stage 1 and 5 only.** It does not touch the vote,
the proof, or the tally.

---

## 6. Stage 4 — the tally, and why results never reach the UI

```
  poll closes (Poll.mergeState, isAfterVotingDeadline)   Poll.sol:476
        │  emits MergeState  ──> Graph indexes stateRoot        [OK]
        ▼
  pnpm --dir packages/contracts merge:sepolia
        │  coordinator merges the message tree
        ▼
  pnpm --dir packages/contracts prove:sepolia
        │  coordinator generates zk proofs off-chain
        ▼
  pnpm --dir packages/contracts submitOnChain:sepolia
        │
        └─> Tally.tallyVotes(_newTallyCommitment, _proof)     Tally.sol:125
              └─> verifyTallyProof(...)                       Tally.sol:169
                    ── zkSNARK verifies the whole tally is correct ──
        │
        └─> Tally.addTallyResults(args)                       Tally.sol:344
              └─> verifyTallyResult(...)                      Tally.sol:309
        │
        ▼
  Tally.isTallied()  →  true                                  Tally.sol:93
  Tally.getTallyResults(index) → per-option totals            Tally.sol:108
        │
        │  ~~~~~~~~~~~~~~~ GAP G06 ~~~~~~~~~~~~~~~
        │  NO EVENT EMITTED.  Tally.sol and ITally.sol both
        │  contain zero `event` declarations.
        │
        │  consequences:
        │    ✗ This subgraph has no configured result ingestion
        │    ✗ No datasource for Tally in apps/subgraph/templates/*.yaml
        │    ✗ No result entity in schemas/schema.v1.graphql
        │    ✗ UI cannot show verified results  →  shows UNAVAILABLE (G05 partial)
        X
  ┌──────────────┐
  │ UI results   │  PollDetail.tsx no longer renders fake totals
  └──────────────┘
```

**This is a required M1 outcome.** Follow the dependency order in
[roadmap.md](roadmap.md); eligibility, a votable poll and browser proving must
also work. Do not defer proving assets until after tally integration.
Two real options (decision D13, unresolved):

```
  OPTION A  contract extension
            add  event TallyResultsAdded(uint256 pollId, uint256[] results)
            to Tally.sol, emit in addTallyResults()
            → Graph indexes it natively
            pro: clean, canonical    con: modifies upstream MACI contract

  OPTION B  call/block indexing (Graph `blockHandlers` / callHandlers)
            read verified result state using supported triggers
            pro: no contract change  con: verify trigger/network support
```

---

The order above is schematic: `addTallyResults` itself requires `isTallied()`
to be true. Completed tally batches do not prove that every option has been
published. Check publication completeness separately before displaying totals.

## 7. Where each technology enters — the answer to "what are we using"

```
  TECH        ENTERS AT        LEAVES AT        FUNCTION THAT PROVES IT
  ──────────  ───────────────  ───────────────  ───────────────────────────────────
  MACI        step 1 signup    step 3 publish   MACI.signUp()            MACI.sol:119
                                                Poll.joinPoll()          Poll.sol:361
                                                Poll.publishMessage()    Poll.sol:265
                                                [OK] 52 tests

  Self.xyz    step 2 scan      step 2 flag      SelfBackendVerifier.verify()
                                                            backend/verify.ts:43
                                                [GAP] stops at localStorage

  The Graph   after any MACI   never leaves —   handleDeployPoll        maci.ts:12
              event is emitted it is the last   handleSignUp            maci.ts:57
                               stage            handlePollJoined        poll.ts:121
                                                handlePublishMessage    poll.ts:38
                                                [OK] 10/10 matchstick
                                                [GAP] no result ingestion

  Tally.sol   after poll close dead end         Tally.tallyVotes()      Tally.sol:125
                                                Tally.addTallyResults() Tally.sol:344
                                                [OK] contract works
                                                [GAP] emits nothing

  ENS         (nowhere yet)    (nowhere yet)    [NONE] zero source references

  Privy/7702  (nowhere yet)    (nowhere yet)    [NONE] on this code snapshot
                                                W1 experiment is on a separate branch;
                                                see status.md before integration
```

---

## 8. The four links that are broken

```
  LINK  FROM → TO              BROKEN BECAUSE                      ID
  ────  ─────────────────────  ──────────────────────────────────  ────
   1    Self → MACI policy     sgData = "0x"; policy = FreeForAll   G01
   2    Tally → Graph          Tally.sol emits zero events          G06
   3    Graph → UI results     no result entity; UI shows unavailable G05
   4    zkeys → browser        proving assets not in public/        G08
```

Use [roadmap.md](roadmap.md) as the single sequencing authority. Link 1
enforces eligibility. Link 4 is required before joining/submitting, hence
before an end-to-end tally. Link 2 publishes verified results; link 3 renders
them. Real poll metadata can be implemented alongside these dependencies.

---

## 9. Maintaining this map

When a stage changes, update **three** things in the same commit as the code:

```
  BEFORE  (today)                      AFTER  (example: ENS shipped)
  ─────────────────────────────        ──────────────────────────────────
  │ ENS        │ [NONE]                │ ENS        │ [OK]
  └────────────┘                       └─────┬──────┘
       no call chain                         │ reverse resolve
                                             ▼
                                       resolver(name) ──> 0x1234…
                                       [apps/front-end/src/lib/ens.ts:42]

   1. the marker          [NONE] ──> [OK]
   2. the call chain      appears, with a REAL file:line citation
   3. the baseline sha    §top  05d8f2a35 ──> <new commit>
```

Never add a function name you cannot verify against a file here. If the design
is agreed but the code does not exist, mark it `[PLAN]` and leave the chain empty.

If Astra (or any agent) proposes a future path, it goes in `build.md` Part A (with a product overview in `journey.md`) —
**not here**. This file is the as-built map.

## 10. Verifying this map yourself

```sh
cd ~/Projects/venekovox

# no ENS code in the runtime/backend/subgraph; front-end ENS read-only page exists now
grep -rniE "\bens\b" apps/backend/src apps/subgraph/src
grep -rn "NamedPoll|NamedPoll|resolvePollName" apps/front-end/src || true

# no dedicated tally events — current ingestion needs another path
grep -nE "event " packages/contracts/contracts/Tally.sol \
                  packages/contracts/contracts/interfaces/ITally.sol

# no tally datasource in the subgraph
grep -nE "Tally" apps/subgraph/templates/*.yaml

# the recipient of a vote is the POLL, not MACI
sed -n '10,18p' packages/sdk/ts/vote/submit.ts

# what the Graph calls on each event
grep -nE "^export function handle" apps/subgraph/src/maci.ts apps/subgraph/src/poll.ts
```

If any of these commands disagrees with this document, the document is stale.
Update it in the same commit that changes the code.

## S5 v2 governance call-path overlay — 2026-09-06

Local patch on main `c12361c3ac2797f98e1238cdca669227fc43ebcc`; not live deployed.

| Chain event    | Actual handler path                           | Added v2 output                                                                   |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| DeployPoll     | `handleDeployPoll` → `createProposal`         | Common governance identity, proposal provenance, time window and explicit privacy |
| PublishMessage | `handlePublishMessage` → `recordPublication`  | Direct publication count; constructor placeholder excluded                        |
| PollJoined     | `handlePollJoined` → `recordRegistration`     | Native unique poll-key registration count; not human turnout                      |
| IpfsHashAdded  | `handleIpfsHashAdded` → `recordOffchainBatch` | Batch announcements separately from message counts                                |

See [governance.ts](../apps/subgraph/src/governance.ts). Native entities remain available.
[The reader](../apps/subgraph/client/governance.mjs) fetches common fields and typed
source-specific metrics from separate Graph endpoints. It is not wired into the main UI.
No Self/ENS/private ballot data is added; no verified tally ingestion is implemented.

## S1.1 ENS poll discovery — 2026-09-06

Implemented on main base `c580b245b8321e04e37164b5d8b21d3298f06f4a`, branch
`feat/ens-poll-discovery`: `/discover` and `/p/:name`, using the Sepolia Universal
Resolver for the `xyz.venekovox.poll` text record. A configured MACI allowlist, matching
`getPoll`, deployed code and voting dates are checked at a consistent block snapshot.
The page is read-only. No main voting route, wallet adapter, identity logic or tally
was changed. Prior “no ENS code” statements describe the older baseline.

Call path: App/Polls link → NamedPoll effect → `resolvePollName` → Universal Resolver
text lookup → MACI/Poll validation → chain-details card. See [build.md A3](build.md).
Ten RPC-double tests passed; live name registration/resolution and browser smoke remain
unverified. A native ENSv2 demo name/record transaction must be supplied by the operator.
