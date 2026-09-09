/** Stage 1 screen inventory. IDs also anchor docs/frontend-round.md.
 * These are UI handoffs, never authorization flags. No preview state enters useMaci.
 */
export const screens = [
  {
    id: "login",
    path: "/login",
    title: "Log in with Privy",
    area: "voter",
    components: "Login button · provider loading · cancel/retry · return destination · session expiry",
    wiring:
      "S2.2: mount a reviewed Privy provider; recover the actual participating account. Verify tokens server-side. W1 createPrivyAdapter currently throws; dashboard setup alone cannot enable execution.",
  },
  {
    id: "account",
    path: "/account",
    title: "Your account",
    area: "voter",
    components:
      "Session · participating address · network · sponsorship · name · eligibility · voting-key recovery · logout",
    wiring:
      "S2.2/S3.1: subscribe to account/chain changes, invalidate stale operations; separate Privy wallet recovery from MACI-key recovery. Never mint a replacement registered key silently.",
  },
  {
    id: "name",
    path: "/account/name",
    title: "Claim your ENS name",
    area: "voter",
    components:
      "Existing name · label input · public-link consent · availability · fees · pending transaction · confirmed resolution · skip",
    wiring:
      "S1.1: Names.tsx and NamingWallet are merged from 3fd87a2e. Injected-wallet claims/recovery are implemented; supply the actual Privy caller adapter next. Check registrar/network/parent, ownership and resolution. ENS is optional, never eligibility.",
  },
  {
    id: "identity",
    path: "/account/identity",
    title: "Verify your identity",
    area: "voter",
    components:
      "Eligibility policy · privacy notice · consent · hosted verification · return/status · expired/rejected/retry",
    wiring:
      "S2.1: mount EnterpriseEligibility.createChallenge/begin/receiveWebhook/authorize with authenticated HTTP routes and durable inbox/session storage. Redirects and localStorage flags cannot authorize voting.",
  },
  {
    id: "keys",
    path: "/account/recovery",
    title: "Recover participation",
    area: "voter",
    components:
      "Wallet recovery · existing voting-key status · device/account mismatch · interrupted operation · safe retry",
    wiring:
      "S3.1 G04: approve account/deployment key scope and migration first. Connect hydration and receiptStatus. Do not collect keys in this shell or promise cross-device recovery.",
  },
  {
    id: "ballot",
    path: "/round/ballot",
    title: "Prepare your private ballot",
    area: "voter",
    components: "Poll reference · eligibility · voting window · account · key readiness · options · review · submit",
    wiring:
      "S3.1/S3.2: bind immutable option indexes, policy and chain/MACI/poll/account; inject signup and join authorizations into voteFlow. Recheck schedule before submit; serve matching proving assets.",
  },
  {
    id: "receipt",
    path: "/round/receipt",
    title: "Submission status",
    area: "voter",
    components:
      "Register → join → encrypt → publish · tx confirmation · check again · refresh recovery · failure/retry",
    wiring:
      "S3.1: use useMaci/voteFlow and receiptStatus with original context. Transaction inclusion is not proof of an individual counted ballot. Never display choice or private key in receipt.",
  },
  {
    id: "results",
    path: "/round/results",
    title: "Verified results",
    area: "voter",
    components:
      "Open/closed · processing · unavailable/error · verified totals · finality · source block · proof/contract links",
    wiring:
      "S4.1: implement consistent-block verified Tally snapshot and metadata binding, then Graph ingestion. Never turn encrypted-message counts into voters or invent totals. Stage 2 breakdowns deferred.",
  },
  {
    id: "admin",
    path: "/admin",
    title: "Admin workspace",
    area: "admin",
    components: "Login/access denied · owned polls · drafts · deployment status · coordinator queue · health",
    wiring:
      "S3.2: authenticated server-side admin role and contract caller authorization; navigation is not access control. Do not use a role toggle or frontend allowlist to authorize writes.",
  },
  {
    id: "create",
    path: "/admin/polls/new",
    title: "Create a poll",
    area: "admin",
    components: "Question/context · ordered options · UTC window · policy · ballot mode/credits · review · draft",
    wiring:
      "S3.2: durable authenticated draft API, validation, immutable metadata digest and idempotent deployment preparation. FULL/one-credit semantics and eligibility policy require confirmation before deployment.",
  },
  {
    id: "publish",
    path: "/admin/publish",
    title: "Review and publish",
    area: "admin",
    components:
      "Metadata review · chain/MACI · policy · coordinator public key · artifact checks · fee review · deployment receipt · ENS/share",
    wiring:
      "S3.2/S1.1: owner-controlled deployment; validate dates, capacities, policy, verifying keys and artifacts. Re-read deployed contracts before publishing metadata/name. No coordinator private key in browser.",
  },
  {
    id: "coordinate",
    path: "/admin/coordinator",
    title: "Coordinate the tally",
    area: "admin",
    components:
      "Close-time check · merge · process · prove · submit proof · publish results · durable job/retry status",
    wiring:
      "S4.1: authenticated job API around existing coordinator/CLI; checkpoint jobs, keep secrets server-side, confirm each chain step. Enable publication only after verified Tally state and matching result commitment.",
  },
  {
    id: "help",
    path: "/help/privacy",
    title: "Privacy and help",
    area: "shared",
    components: "Trust boundaries · public metadata · recovery · failures · support · data handling",
    wiring:
      "Publish approved provider/issuer retention and support policy before real-document use. Standard MACI coordinator can decrypt commands; issuer/provider trust remains in Stage 1.",
  },
] as const;
export type ScreenId = (typeof screens)[number]["id"];
