# VenekoVox technical journey map

**Purpose:** a call-by-call ASCII map of what each technology does and when it enters.
Every function name below was read from source in this repository, not from memory.

**Read this first, then any other doc.** If a claim here disagrees with another doc,
this file is wrong or stale — fix it here.

Baseline: `main` @ `05d8f2a35` (2026-09-05). Chain: Sepolia `11155111`.
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
                                     │ bridge (G01)     │                 │  cannot index   │
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
`Tally.sol` has no events, so the Graph cannot see results. Everything else
in the map is connected or plainly absent.

---

## 2. Stage 3 — the vote, call by call

This is the only stage with end-to-end code. Entry: `apps/front-end/src/hooks/voteFlow.ts`.

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
              │      ── ENCRYPTION ──  ECDH shared secret between the      │
              │         voter's MACI key and the COORDINATOR's key →       │
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

| Question                            | Answer                                        |
| ----------------------------------- | --------------------------------------------- |
| Is the ballot encrypted?            | Yes — to the coordinator's public key         |
| Is it on-chain?                     | Yes — `Poll.publishMessage`                   |
| Is it anonymous to the coordinator? | **No.** Coordinator holds the decryption key  |
| Is it counted?                      | **No.** Counting is stage 4                   |
| Can anyone else link it to me?      | Signup tx links wallet → MACI pubkey publicly |

---

## 3. Stage 5 — where The Graph enters (and where it stops)

The Graph never talks to MACI. **It only reads event logs.** There is no
push from MACI to the Graph.

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
    │                                          ^^^^ THIS IS THE TURNOUT      .registrationCount
    │                                               METRIC — auditable but
    │                                               NOT attributable
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
  │ 2. NO RESULTS. Tally.sol emits no events → the Graph indexes nothing   │
  │    about outcomes. `poll.tally` is stored as an address and never      │
  │    read. There is no `Tally` datasource in templates/*.yaml.           │
  │                                                                        │
  │ 3. `registrationCount` counts REGISTRATIONS, not unique humans.        │
  │    Self proof → contract bridge does not exist (G01), so two wallets   │
  │    = two registrations.                                                │
  └────────────────────────────────────────────────────────────────────────┘
```

### What the Graph CAN already answer today (prize evidence)

```
  Q: how many people joined poll X?     A: Poll.registrationCount   [OK] live
  Q: how many encrypted messages?       A: Poll.numMessages         [OK] live
  Q: when does the poll close?          A: Poll.startDate/endDate   [OK] live
  Q: what were the results?             A: ✗ IMPOSSIBLE today       [GAP G06]
```

That third row is the honest Graph pitch for the prize: **turnout without
attribution.** Auditable, non-attributable — which is exactly the
standardization gap the Messari governance schema does not cover.

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
  │ browser flag │  localStorage "verified" = true
  └──────┬───────┘
         │
         │  ~~~~~~~~~~~~~~~~~~~~ GAP G01 ~~~~~~~~~~~~~~~~~~~~
         │  NOTHING reaches the chain.
         │  MACI.signUp(_publicKey, _signUpPolicyData) is called
         │  with sgData = "0x"  (voteFlow.ts:83) — empty policy data.
         │  The deployed policy is FreeForAll → ANY wallet can vote.
         X
  ┌──────────────┐
  │ MACI policy  │  ← should reject unverified wallets here
  └──────────────┘
```

**The one-line version:** Self proves you are a person. The contract never
hears about it. Anyone with a wallet can vote today.

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
        │    ✗ The Graph cannot index results (events are its only input)
        │    ✗ No datasource for Tally in apps/subgraph/templates/*.yaml
        │    ✗ No result entity in schemas/schema.v1.graphql
        │    ✗ UI cannot show verified results  →  shows MOCK data (G05)
        X
  ┌──────────────┐
  │ UI results   │  hardcoded numbers in PollDetail.tsx
  └──────────────┘
```

**Fixing this is the highest-value single piece of work in the project.**
Two real options (decision D13, unresolved):

```
  OPTION A  contract extension
            add  event TallyResultsAdded(uint256 pollId, uint256[] results)
            to Tally.sol, emit in addTallyResults()
            → Graph indexes it natively
            pro: clean, canonical    con: modifies upstream MACI contract

  OPTION B  call/block indexing (Graph `blockHandlers` / callHandlers)
            poll Tally.getTallyResults() on a schedule
            pro: no contract change  con: polling latency, not event-driven
```

---

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
                                                [GAP] cannot see results

  Tally.sol   after poll close dead end         Tally.tallyVotes()      Tally.sol:108
                                                Tally.addTallyResults() Tally.sol:344
                                                [OK] contract works
                                                [GAP] emits nothing

  ENS         (nowhere yet)    (nowhere yet)    [NONE] zero source references

  Privy/7702  (nowhere yet)    (nowhere yet)    [NONE] 2 vendor reports only
                                                would change the `signer` in
                                                every [OK] call above
```

---

## 8. The four links that are broken

```
  LINK  FROM → TO              BROKEN BECAUSE                      ID
  ────  ─────────────────────  ──────────────────────────────────  ────
   1    Self → MACI policy     sgData = "0x"; policy = FreeForAll   G01
   2    Tally → Graph          Tally.sol emits zero events          G06
   3    Graph → UI results     no result entity; UI shows mocks     G05
   4    zkeys → browser        proving assets not in public/        G08
```

Fix them in that order. Link 1 makes the product claim true.
Link 2 makes the results real. Links 3 and 4 are downstream of 2.

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

If Astra (or any agent) proposes a future path, it goes in `integration-spec.md` —
**not here**. This file is the as-built map.

## 10. Verifying this map yourself

```sh
cd ~/Projects/venekovox

# no tally events — this is why results cannot be indexed
grep -nE "event " packages/contracts/contracts/Tally.sol \
                  packages/contracts/contracts/interfaces/ITally.sol

# no tally datasource in the subgraph
grep -nE "Tally" apps/subgraph/templates/*.yaml

# ENS does not exist in the repo
grep -rniE "\bens\b" apps/front-end/src apps/backend/src apps/subgraph/src

# the recipient of a vote is the POLL, not MACI
sed -n '10,18p' packages/sdk/ts/vote/submit.ts

# what the Graph calls on each event
grep -nE "^export function handle" apps/subgraph/src/maci.ts apps/subgraph/src/poll.ts
```

If any of these commands disagrees with this document, the document is stale.
Update it in the same commit that changes the code.
