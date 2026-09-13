# Civic story cover — 2026-09-12

Owner: Astra. S3.2 presentation iteration on `codex/judge-experience`, starting at
`53d1def6` in `/private/tmp/venekovox-judge-experience`.

## Direction

User requested a more distinctive storytelling experience inspired by
https://www.y-n10.com, historical authoritarian imagery, people gathering, and
creative visual explanations of the technologies. Inspected the reference's entry
screen and its dark, spatial, voxel-style world. Borrow the ambition of an authored
experience and chapter progression; do not copy its artwork or implementation.

VenekoVox's interpretation is an editorial civic zine: warm paper, black ink,
vermilion, large sans typography with serif italic interruptions, tilted montage,
numbered chapters, and an interactive technology exhibit. The cover headline is
“Power loves a monologue. Give it a conversation.”

Story: concentrated voice → plural voices → technical responsibilities → real poll
explorer → recurring civic participation as the longer-term vision. The historical
motif establishes the problem; the people and the product carry the resolution.

## Delivered

- Replaced `Landing.tsx`; scoped `styles/story.css`; shared navigation/footer adopt
  paper styling only on this route. This cover uses one intentional paper palette;
  the theme control remains available on participation routes.
- Four keyboard-operable exhibit buttons (native buttons with pressed state and
  a polite live explanation): ZKPassport, MACI, ENSv2, The Graph.
- CSS/DOM illustrations: document/proof token, sealed ballot, public name tag,
  event/index/root-check chain. These illustrate concepts, never actual user state.
- Links into existing `/polls`, `/names` via navigation, `/journal`, `/journal#trust`.
- Flagship AI question is labeled a concept; the explorer owns configured availability.
- Existing wallet, naming, eligibility, voting and receipt logic is untouched.

## Image provenance

`apps/front-end/public/story/voices-collage.png` is original AI-generated editorial
art, generated with the built-in imagegen tool on 2026-09-12. It depicts a fictional
authoritarian figure, not a sourced portrait of Franco or a documented historical
event. Visible caption explicitly labels it AI-generated editorial illustration.
Alt text describes the composition. No third-party reference artwork was reused.

Prompt direction: 1536×1024 warm ivory paper; coarse black-and-white halftone
photographic cutout montage; a large anonymous 1930s authoritarian figure at
microphones with a vermilion strip across his eyes; diverse ordinary people gathered
on the right, enclosed by an open red brushstroke circle; rough torn edges;
contemporary museum-poster/civic-zine aesthetic; no text, flags, emblems or weapons.
The original output is copied into the project, 3.1 MB PNG. A smaller delivery
encoding is an optional subsequent performance improvement.

## Verification

- Repository Node 22 toolchain: `pnpm --dir apps/front-end build` passed.
  Existing SDK missing-export, stale Browserslist and large-chunk warnings remain.
- `pnpm exec prettier --write apps/front-end/src/pages/Landing.tsx apps/front-end/src/styles/story.css`.
- Browser at localhost:3012: inspected desktop (1440×1000), phone (390×844), and
  intermediate default viewport. Document width equals viewport width at 1440/390.
- Clicked all four exhibits and checked the corresponding headings; Tab from
  ZKPassport reaches MACI; Enter activates it and updates `aria-pressed`.
- Mobile menu opens and routes to the actual unconfigured poll explorer.
- Reduced-motion users get no exhibit entrance animation; text is always present.
- `git diff --check` passed. No new runtime/security logic, no added test suite.

Not live evidence: no wallet, passport, vote, tally, deployment or public HTTPS
check in this turn. The explorer currently says no poll is configured in this
preview. Existing untracked video/poster assets and `video/` are preserved.

## Pickup

Review the local preview. If accepted for submission, integrate this presentation
with the actual configured judge deployment and run its real journey. Do not derive
poll availability or prize claims from this cover. Changes are left uncommitted;
no merge, push, live-server restart or external publishing was performed.

## Imagery extension — 2026-09-12

Alejandro approved the cover and requested the same style across the rest of the
website. Added four original AI-generated companion collages under `public/story/`:
`gathering.png`, `introduction.png`, `proof.png`, `ballot.png`. All use ivory paper,
black-and-white photographic halftone cutouts and vermilion brushstroke accents.
No historical source or real user identity is claimed. Images have descriptive alt
text and visible AI illustration captions.

`EditorialArt.tsx` shares captions, dimensions and lazy loading. The homepage adds
public-square and sealed-ballot imagery; Polls gets a split illustrated cover;
Names, Auth and PollDetail get compact artwork; Journal gets three visual breaks.
`editorial.css` carries ink/paper/vermilion tokens through light and dark themes.
A small unconfigured-poll copy edit removes an internal operator name. No wallet,
authorization, ballot selection, submission, or receipt behavior changed.

Validation: Node 22 `pnpm --dir apps/front-end build` passed with the same existing
SDK-export, Browserslist and bundle warnings. Browser reviewed desktop poll explorer
in dark theme, naming in light theme, 390px eligibility and journal, and the new
homepage section. Eligibility and unconfigured ballot images loaded; document width
was 390 at the 390px checks. Mobile layouts retain the real unconfigured statuses.
No wallet connection, identity proof or vote was attempted. `git diff --check` passed.

All images remain local PNG originals; below-fold images use native lazy loading.
No publish, push or commit. The original collage and pre-existing video assets are
preserved. Next: review the illustrated journey at localhost:3012/polls.


## Accepted collage direction — 2026-09-13

Owner: Astra. Worktree `/private/tmp/venekovox-judge-experience`, branch
`codex/judge-experience`. Alejandro explicitly approved the new artwork. The
original general-with-covered-eyes hero stays. Earlier smiling-group companion
art and repeated red circles are superseded by serious halftone object collages,
torn paper and small cobalt, mustard, lilac and green accents.

### As implemented

- `/`: original hero → flagship + France/Brazil/more teasers → four independent
  technology chapters → four concrete problems → closing invitation.
- `PollBoard`: flagship Yes/No/Unsure are an answer preview; the CTA opens
  `/polls#configured-poll`, where actual availability is checked. Teasers are
  explicitly unopened independent opinion polls, not official election ballots.
- `TechnologyStory`: ENSv2 ownership, ZKPassport eligibility, MACI/Ethereum ballots,
  The Graph records. Each has short prose, its own illustration, an ordered flow
  and native expandable details. Navigation targets `/#how-it-works`.
- `ProblemCollage`: political persecution, social pressure/ostracism, lack of
  representation and untrustworthy polling, with specific responses and limits.
- `EditorialArt`: shared descriptive alternatives, dimensions, lazy loading and
  visible AI attribution; naming, eligibility, ballot and journal reuse the new
  appropriate assets. No wallet or voting state logic was changed.

### Artwork provenance

Eight original generated images in `public/story/v3-*.jpg`: flagship (brain/chip/
ballot), name (key/registry), proof (redacted passport/phone), maci (cipher machine),
graph (inspection/records), problem (censorship/surveillance/manipulated ballot),
france (ballot/civic architecture), brazil (voting machine/civic architecture).
Generated with the original hero as aesthetic reference. No historical attribution
or real-person identity is asserted. Native JPEG encoding at quality 88 reduces
the new delivery assets to roughly 6 MB total; original generated PNGs remain in
Codex's generated_images folder for this task. Earlier project PNGs are preserved.

### Product and technical boundaries

The requested worldwide flagship audience supersedes the earlier restricted
product direction, but is labeled planned pending configuration. Current backend
`eligibility/product.ts` defaults to a nationality allowlist when its environment
setting is absent; an explicitly empty allowlist removes the nationality predicate.
The existing flagship descriptor also carries the previous restriction. Neither
was edited here. Owner/operator must align policy, descriptor and fresh verified
configuration before worldwide participation is claimed. Supported documents,
18+ eligibility and actual deployment availability still matter.

ENS is public optional naming, not personhood or privacy. The phone generates a
passport proof; the issuer verifies the proof and requested results and handles
account/uniqueness information. MACI's coordinator can decrypt ballots; metadata
remains public. A publication receipt is not a counted vote. Ethereum replication
does not remove frontend/issuer/coordinator availability limits. Indexed records
must be checked against chain state; they are not a final tally.

Copy was checked against repository implementation and official context:
[ZKPassport privacy policy](https://zkpassport.id/privacy-policy),
[Ethereum security](https://ethereum.org/roadmap/security/) and
[Why build on Ethereum](https://ethereum.org/latest/why-build-on-ethereum/).

### Verification and interruption record

Node 22 repository toolchain: `pnpm --dir apps/front-end build` passed (3290 modules).
Existing optional MACI SDK export, Browserslist and large bundle/WASM warnings
remain. Targeted Prettier formatting and `git diff --check` passed. No new tests
were added for presentation-only changes.

Browser checked desktop 1440 and mobile 390 widths with no horizontal overflow.
Flagship and teaser layouts, separate chapter layout, disclosure click and Enter
activation, and the Have your say route were checked. No broken loaded images
were found. CTA reaches the real unconfigured explorer. Viewport override reset.
No wallet connection, identity proof, vote, tally, public HTTPS or deployment was
verified. No push, commit or publishing performed. Existing dirty main checkout,
untracked video files and prior artwork remain intact.

Next pickup: integrate the accepted presentation with an actual configured poll,
align worldwide eligibility and run the real judge journey. Do not infer live
readiness from this visual review.


## Full journey presentation and merge gate — 2026-09-13

Extended accepted collage styling through naming, passport verification, ballot/
receipt/results, ENS discovery and the legacy creation/discussion previews.
Only markup/styles and illustration imports changed; existing handlers, account
binding, verification, storage, receipt recovery and tally logic are preserved.
Legacy sample pages explicitly disclose their prototype status.

Build passed and frontend unit tests passed 122/122. Browser checked naming,
eligibility (including 390px overflow/disclosures), unconfigured ballot/results,
and discovery validation/dark theme. This is local UI evidence, not a live vote.
Existing optional SDK export and bundle/Browserslist warnings remain.

User authorized commit and push of the design branch. Merge compatibility against
`origin/main` at `cef72d13` found existing ENS registration/wallet/naming, App routes,
environment example, ENS tests and canonical-doc conflicts. Do not resolve these
by blindly choosing ours/theirs. The tally closing is not a prerequisite for the
presentation merge; reconciling concurrent ENS implementations is. Preserve the
operator's live configuration and do not overwrite the other worktree.

Delivery includes the active hero and eight v3 JPG assets. Superseded PNG companions and unrelated untracked video work are left on disk outside the commit.

## Design integration with current ENS — 2026-09-13

User authorized merging the accepted design into main. Integration starts from
main cef72d13 and merges judge-experience 67097e1b. Main's ENS registration,
injected wallet, discovery primitives and ENS tests remain authoritative. The
naming page wraps that implementation in the shared collage design; old optional
resolver/theme onboarding modules and their unused contract/test scaffolding
are excluded. Homepage and journal copy now describe atomic name/address
registration and fixed records. Main's default Vite port remains 3000.

The judge experience's descriptor-driven ballot, schedule guards and receipt
presentation are retained. This merge does not configure a poll, change running
services or establish a live identity/vote/tally result. Existing environment
files and operator credentials were not copied or modified. Earlier separate
branch and editable-profile descriptions below are historical, superseded here.

Integration verification: production build passed; frontend unit 116/116, ENS UI
3/3 and backend poll/tree suite 29/29 passed. The old profile-theme tests were
removed with the superseded modules. Built preview on 3014 renders the main ENS
naming page with collage and eligibility navigation. Ballot displays the wallet
address without the obsolete theme/profile hook. No live wallet, proof or tally
operation was performed. Existing SDK optional-export and bundle warnings remain.
