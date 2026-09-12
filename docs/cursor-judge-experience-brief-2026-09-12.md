# Cursor implementation brief — VenekoVox judge experience

Date: 2026-09-12. User reports just over 12 hours until submission; confirm actual
remaining time at pickup. This is execution work, not another architecture proposal.

## 1. What Alejandro wants

1. A beautiful, modern, distinctive product: judges should feel this is a serious,
   thoughtfully designed civic platform.
2. Judges must be able to participate in a real poll.
3. Guided journey: claim ENS name → verify eligibility → join poll → encrypted
   vote → receipt → verified results when available.
4. Subtle explanations throughout; plain language first, optional technical detail.
5. An accessible blog article structured around lessons, sponsor integrations and
   the platform vision. It must be readable by someone unfamiliar with crypto.
6. A NEW flagship poll about a global ban on artificial superintelligence, eligible
   to US, Canadian, Australian and EU citizens. Keep existing age 18+ requirement.

Hermes owns ENS deployment, new-poll deployment and tally work when online.
Cursor owns the frontend/product experience, metadata plumbing, article and tests.
Do not wait for deployment to finish the code; do not invent deployment success.
Do not message Hermes or publish externally without explicit user authorization.

## 2. Exact checkout and interruption state — READ FIRST

Continue the existing isolated worktree:

- Path: `/private/tmp/venekovox-judge-experience`
- Branch: `codex/judge-experience`
- HEAD: `0962da7e`, based on the existing `feat/s11-ensv2-named-accounts`.
- This is NOT a competing ENS implementation. It carries the current ENS candidate
  plus unfinished presentation changes.
- IMPORTANT: remote ENS branch has advanced to `c92153a3` (review repairs).
  Review and incorporate that commit BEFORE validating this branch. It changes
  `registration.ts`, `profile.ts`, `useNamedAccount.ts`, `Names.tsx`, tests and docs.
  Preserve the new UI edits when resolving `Names.tsx`. Do not revert these repairs.
- Inspect status/branches again: other agents are working concurrently.
- Original checkout `/Users/avb/venekovox` has pre-existing dirty docs and research;
  preserve it. Do not restart the live Mini app or change its ports/config.
- Local node_modules and frontend node_modules here are symlinks to the existing
  ENS worktree's dependencies. They are validation conveniences, not deliverables.
  Do not reinstall through those symlinks and mutate the other agent's packages.

Uncommitted partial work already present:

- NEW `apps/front-end/src/components/Experience.tsx`: shared navigation/footer,
  theme toggle, route scroll reset, JourneySteps and expandable FieldNote.
- `App.tsx`: wraps routes in Experience and imports a Journal page.
- `Landing.tsx`: initial new hero/process/story markup. Original file is available
  in git; preserve the good civic narrative, but not inaccurate absolute claims.
- `Polls.tsx`: initial featured ballot/explorer markup with real configured state.
- `Names.tsx`: initial step guide and explanatory text, provider cleanup.
- `Auth.tsx`: English default, step guide, explanation text and continuation to
  the configured ballot. Proof payload excerpt replaced with expiry time.
- `PollDetail.tsx`: ONLY English default + wrapper class changed so far. Ballot
  mismatch described below remains UNFIXED.
- `polls/descriptor.ts`: preliminary `superintelligence-v1` preset described below.

THIS IS NOT BUILDABLE OR FINISHED: `pages/Journal.tsx` does not yet exist; new CSS
classes are not implemented; duplicate page headers remain; no build, browser QA,
unit tests or live transactions were performed on these changes. Treat all partial
code as a starting point to review, not accepted implementation.

## 3. Product direction and visual acceptance

Use the existing design references:
`docs/design/poll-mockups-2026-09-09/v2/README.md` and its three PNG boards.
View the actual boards before styling. These are concepts, not authoritative state.

Direction: welcoming civic technology with a restrained cypherpunk edge.
- Dark forest `#101916`, moss panels `#1B2923`, warm white, lime `#CDFA77`.
- Light mode: porcelain `#F5F6F0`, forest text, white cards, accessible green accents.
- Bold humanist/geometric sans typography; oversized editorial headings, readable
  body copy, precise spacing, thin rules, restrained corners, expressive negative space.
- Abstract ballot/glass/orbit artwork can be built with CSS/SVG; avoid stock photos,
  flags-as-hero, generic blue dashboards, fake activity, excessive neon and hacker motifs.
- Main line: “Your voice. On your terms.”
- Inclusive promise: “You don’t have to agree to belong here.”
- Keep the motivation: costly speech, being drowned out, a shared space for differing
  views. Do not invent a founder biography or imply a representative sample.

Implement one coherent system across every route in the demonstrated journey.
Prefer shared tokens/components over blanket CSS overrides of all Tailwind classes.
Remove duplicate old headers as the shared header takes over. Include actual light
and dark treatments, mobile navigation, focus states, reduced-motion support,
accessible contrast, labeled form inputs and readable busy/error states.

No dead search/filter buttons, fake poll cards, fabricated totals or placeholder
footer links. The only poll card shown as actionable must bind to a configured poll.
Upcoming content can be editorial, clearly separate from deployed polls.

## 4. Flagship poll — question, scope and evidence

Question:
“Do you support a global ban on developing artificial superintelligence?”

Freeze these option indices before deployment:
- 0: Support
- 1: Oppose
- 2: Unsure

Neutral explanation:
“For this poll, artificial superintelligence means AI that substantially exceeds
human abilities across almost all intellectual tasks. A global ban means countries
agreeing to prohibit its development, rather than a temporary pause or a ban on all AI.”

Explain that this is a broad policy question, not endorsement of every provision
in a particular bill. Do not mix a permanent ban and a temporary pause into one
answer option. Present all three options equally; no green-for-support/red-for-oppose.

Research verified September 12:
- Sanders/Casar announced forthcoming legislation September 3 proposing a permanent
  development/deployment ban, a temporary advanced-AI pause and international coordination:
  https://www.sanders.senate.gov/press-releases/news-sanders-casar-introduce-legislation-to-ban-artificial-superintelligence-and-temporarily-pause-advanced-ai-development/
- Background debate and definitions:
  https://lordslibrary.parliament.uk/superintelligent-ai-should-its-development-be-stopped/
- EU membership:
  https://employment-social-affairs.ec.europa.eu/policies-and-activities/moving-working-europe/eu-social-security-coordination/frequently-asked-questions/faq-social-security-where-do-these-rules-apply_en

The subject is current; “the most viral topic on X” was NOT independently verified.
Do not invent view counts, trending rank or claim the proposal is enacted law.
Use a small “Read the context” disclosure with links, not persuasive campaign copy.
Keep summaries brief and original; sources represent different roles, not consensus.

Eligibility: document nationality/citizenship proxy, NOT residence or IP location.
United States, Canada, Australia, plus Austria, Belgium, Bulgaria, Croatia, Cyprus,
Czechia, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Ireland, Italy,
Latvia, Lithuania, Luxembourg, Malta, Netherlands, Poland, Portugal, Romania,
Slovakia, Slovenia, Spain, Sweden. Exactly 30 nationalities; UK is NOT included.
Check exact CountryName spellings in installed ZKPassport SDK (e.g. Czechia versus
Czech Republic) before preparing the backend env. A listed nationality does not
promise every document/device is supported.

Keep age >=18, D17 salted uniqueness and strict FaceMatch. Do not silently weaken
checks or accept mock proofs to let a judge through. Judges outside the selected
cohort can explore the site but cannot vote; state this before they begin onboarding.

## 5. New deployment and metadata boundary

Do not relabel Poll 1 or infer the next poll ID. Hermes provides actual chain/MACI/
poll/policy/tally addresses, dates, mode and read-back evidence.

Partial descriptor supports `VITE_POLL_PRESET=superintelligence-v1` and the existing
chain/MACI/poll settings. It rejects unknown presets and prevents applying this
preset to original deployment poll IDs 0/1. Review and strengthen deployment binding:
metadata must not silently label an arbitrary configured deployment as this poll.
Keep the existing France poll metadata available for its original deployment.
Add env types/examples, deployment manifest and tests. Show pending/unconfigured
truthfully until new deployment values are available. Never bake a speculative ID.

Existing backend uses `ZKP_NATIONALITY_ALLOWLIST` (comma-separated CountryName
strings), fixed minimumAge 18 and `ZKP_CONFIG_ID`. Prepare Hermes's exact nonsecret
configuration. Use a fresh policy/config identifier binding the new poll's semantics;
verify consistency with the issuer and deployed contract. No live .env changes here.

CRITICAL: the current poll schedule reader checks chain/poll/window, not the full
option count/mode. Verify the new deployment's `voteOptions == 3` and voting mode
against the expected manifest before enabling the flagship ballot; fail closed on
mismatch. Preserve existing chain/network identity checks and bounded reads.

TWO DISTINCT DEMO NEEDS:
- Judges need an OPEN poll while judging.
- Tally needs a CLOSED poll; Poll contracts do not permit normal counting before close.
Prepare a manifest model/runbook supporting an open flagship round and a separately
closed rehearsal round. Never display rehearsal results as results of the open round.
Coordinate actual windows with Hermes; do not guess judging duration/deadline.
Existing Poll 1 closes Sept 16 and S4.1 brief reports its coordinator key lost; it
cannot be our new tally target. Hermes handles a fresh recoverable key, privately.

## 6. Screen-by-screen implementation

### Landing `/`
Hero + abstract ballot artwork, clear “Find a poll” CTA, flagship editorial teaser,
four short journey steps and civic story. Provide “Get started” → `/names`.
Explain requirements before wallet interaction: Sepolia browser wallet/test ETH,
ZKPassport phone app, supported document and poll eligibility. Avoid an intimidating
wall of technical setup; put details in an expandable checklist.

### Poll discovery `/polls`
One real configured flagship card, live-checked window label, the three neutral
options as a noninteractive preview, eligibility summary and clear CTA. Loading,
missing configuration and read failure are distinct. An unavailable schedule is not
“Closed.” Add a real retry control. No invented voters, percentages or social proof.

### Name claim `/names`
Use existing ENSv2 branch and its review repairs. A public name visibly belongs to
its owner, with accurate public-linkage consent. Claim, incomplete, ready, rejected,
unavailable, wrong-chain, wrong-account and lookup-failure states need polished copy.
Show progress appropriate to actual wallet operations: resolver → register → records.
Avoid implying the transaction is complete before mined receipt/read-back checks.
Retain resumability after partial success; do not register twice after rejection.
Name availability errors should be understandable. Public name is NOT personhood.

Make the ready state feel special: the user's resolved name with their selected
profile theme, followed by a prominent “Continue to eligibility.” A secondary skip
is appropriate because ENS is not contract authorization; the preferred journey
still begins with naming. Never turn a route visit into a completion checkmark.

### Eligibility `/trust-ritual`
Show actual poll requirements before starting. Steps: connect existing account,
sign account-control challenge, scan/deep-link with phone, wait for verification,
authorization ready, continue to THIS poll. Show expiry without exposing grant data.
Use the same wallet account through ENS/eligibility/voting. Audit account-switch,
unmount, duplicate callback and expired-grant behavior; keep the existing security
boundary. UI success follows server authorization, not SDK progress alone.

Microcopy: “Your phone creates the proof. Our server verifies it and issues a
short-lived permission for this poll.” Deeper disclosure: issuer trust, document
support, public transaction metadata. No “nothing ever reaches a server” promises.

### Ballot `/polls/:id` — priority bug fix
CURRENT BUG: descriptor lists six candidates, but PollDetail still renders
Yes/No/Abstain and maps them to indices 0/1/2. Fix the general mismatch:
render `descriptor.options`, select its real numeric index, and pass that index to
`maci.vote`. Do not silently translate display positions or reuse old yes/no keys.

Use a keyboard-accessible radio group and separate “Submit encrypted ballot”
button. No selection by default. Equal visual weight for every option. Before
confirmation, explain wallet prompts: signup if needed, join if needed, then publish.
Preserve `useMaci`, read-provider routing, pinned join proof, single-submit lock,
receipt reconciliation and the vote-time window recheck. Do not rewrite crypto.

The current `maci.vote` orchestrates signup/join/publish; do not fake a separate
completed join. Show its actual intermediate states and offer verification guidance
when grant missing/expired. Distinguish name, eligibility, membership and receipt.

### Receipt / results
Successful receipt: “Encrypted ballot submitted”; transaction explorer link,
copy transaction hash with feedback, recheck and reconnect/refresh behavior.
Do NOT redisplay the selected choice in the persistent receipt. Store no choice.
Show pending/reverted/unexpected/unavailable/unverified distinctly. A pending or
unknown send must not allow blind duplicate submission.

Results: no chart or zero total until an actually verified tally exists. Integrate
Hermes's final results contract/API; do not invent the endpoint now. Show poll
identity, source block, tally contract, per-option labels/counts and verification
state. Untallied, unavailable and verified-zero are separate. A single-voter tally
reveals that voter's choice; don't call that evidence of crowd anonymity.

### Journal `/journal`
Write and implement the real page; it is currently imported but MISSING.
Suggested title: “A name is not a person. A receipt is not a result.”
Standfirst: what we learned building a place for real voices and checkable votes.
~1,000–1,400 words, readable sections, table of contents, strong typography, links
and simple inline diagrams only if useful. Also save Markdown in `docs/blog/`.

Suggested narrative:
1. Why civic voice needs something better than loudness and likes.
2. ENSv2: a name is a public profile. Registry = neighborhood address book;
   resolver = profile record; scoped permission = permission to edit one field.
   Explain actual UserRegistry / Permissioned Resolver / EAC work, deployed status
   honestly, and that registrar cannot edit an owner's address in our design.
3. ZKPassport: prove the requirement rather than publish a document. Phone proof,
   server verification, issuer authorization and the remaining trust boundary.
4. MACI: seal the ballot, then prove the count. Attribute upstream MACI; do not
   claim we invented its cryptography or delivered complete coercion immunity.
5. The Graph: turn chain events into useful public information and joining proofs.
   Explain indexed state leaves, checking the rebuilt root and the Messari-derived
   partial governance projection. Distinguish joined/message counts from results.
6. A debugging lesson: wallet RPC reads can fail even when contracts are fine;
   use explicit read providers. Use the existing blog drafts as technical sources.
7. What is working, what requires deployment, and why evidence beats green UI ticks.
8. Vision: recurring civic conversations, richer privacy-protected aggregates,
   less operator dependence later. Clearly label these as future work.

Anchor privacy details at `/journal#trust` to satisfy navigation. No blanket
anonymity, “zero bots,” “free forever,” “no wallet,” “no gas,” “impossible retaliation”
or “all tallies indexed” claims. Do not manufacture interviews, user counts or quotes.

## 7. Execution order and validation

1. Inspect worktree; integrate c92153a3 review repairs, preserving dirty presentation.
2. Finish design tokens, Experience frame, missing Journal, and remove duplicate headers.
3. Fix descriptor-driven ballot + deployment validation and connect the journey.
4. Polish all actual loading/error/success states, mobile and light/dark themes.
5. Run Node 22 toolchain and frontend unit tests/build; add targeted regressions for
   new preset, old-poll protection, option-index submission, wrong deployment and
   no duplicate publish. Add meaningful UI coverage for selection/confirmation.
6. Browser-check landing → explorer → names → eligibility → ballot on desktop and
   390px mobile. Inspect screenshots, navigation, focus, overflow and readable text.
   Use synthetic states ONLY in explicit test harnesses; no mock production success.
7. With Hermes deployment, bounded real journey + receipt read-back and grant expiry/
   wallet rejection checks. Record what was actually tested, separately from code.

Use repository toolchain: `/Users/avb/Hermes-crypto-builder/p2-toolchain/node22/bin`
and pnpm-home/bin. Standard frontend commands: `pnpm --dir apps/front-end test:unit`
and `pnpm --dir apps/front-end build`. ENS tests are included; respect any updated
commands in the current branch. Do not claim live proof correctness from unit tests.
Run isolated preview on 3012 (strict port); don't disturb Mini 3000/3100 or ENS 3010.
No secrets, wallet keys or documents in logs, artifacts, screenshots or commits.

## 8. Delivery / handoff

Update canonical `docs/status.md`, `docs/roadmap.md`, `docs/journey-map.md` and
`docs/agents.md` with concise current evidence and interruption record. Preserve
historical records but make the current state clear. Include new poll manifest,
article, screenshots and exact test outcomes. Commit scoped changes on this branch;
no deployment, merge or push claim without doing and verifying the action.

Hermes checklist to hand to Alejandro:
- Integrate the repaired ENS branch plus judge UI, resolving latest-main changes.
- Supply native ENSv2 registry/registrar configuration and verify real resolution.
- Supply fresh flagship poll manifest; 3 options; US/CAN/AUS/EU27, age 18+, strict
  FaceMatch/salted real proofs; exact CountryName allowlist; fresh policy/config ID.
- Keep a judge round open; use a separately identified closed tally rehearsal.
- Retain coordinator key safely; provide verified results interface + read-back.
- Public HTTPS frontend/backend/QR origin must work outside Tailscale. Last public
  `https://app.uxisnear.com` request timed out; internal access is insufficient.
- Prepare test ETH instructions/access for judges; do not promise gas sponsorship.
- Rebuild SDK/dependencies and verify served artifacts before recording the demo.

Do not spend the deadline on new Privy integration, demographic analytics,
additional sponsors, registry redesign or broad backend refactors. Finish this
single complete product journey and its evidence.
