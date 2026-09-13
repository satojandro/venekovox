import { EditorialArt } from "../components/EditorialArt";
import { Link } from "react-router-dom";

export default function Journal() {
  return (
    <article className="journal-page">
      <p className="eyebrow">BUILD JOURNAL / SEPTEMBER 2026</p>
      <h1>A name is not a person. A receipt is not a result.</h1>
      <p className="standfirst">
        What we learned building a place for real voices and checkable votes — and what is still
        waiting on a deployment we can point to.
      </p>
      <EditorialArt scene="gathering" />
      <nav aria-label="Article contents">
        <ol className="journal-toc">
          <li><a href="#voice">Why civic voice needs more than loudness</a></li>
          <li><a href="#ens">A name is a public profile</a></li>
          <li><a href="#trust">Prove the requirement, not the document</a></li>
          <li><a href="#maci">Seal the ballot, then prove the count</a></li>
          <li><a href="#graph">Public events are not results</a></li>
          <li><a href="#rpc">When the wallet’s RPC lies</a></li>
          <li><a href="#evidence">What is working, and what is not</a></li>
          <li><a href="#vision">What we hope comes next</a></li>
        </ol>
      </nav>

      <h2 id="voice">1. Why civic voice needs something better than loudness</h2>
      <p>
        Online conversation rewards volume. The people who shout, post often, or already have a
        following are easy to hear. The people who hesitate — because speech feels costly, or because
        they are simply drowned out — disappear into the noise. We wanted a shared question that real
        people could answer, and a count that someone else could check.
      </p>
      <p>
        That is a product problem, not a slogan. Eligibility has to mean a person meeting a rule, not
        a wallet that showed up. A ballot has to stay private while it is open. A result has to be
        more than a green tick in a user interface. None of those jobs is done by a trending topic.
      </p>

      <h2 id="ens">2. ENSv2: a public name for your account</h2>
      <p>A registry records who owns a name. A resolver answers what that name points to. Our Sepolia deployment registers your label and sets its address record in one transaction, then the client checks the result through the Universal Resolver.</p>
      <div className="diagram" aria-hidden="true">
        <div><strong>Choose</strong>A readable label</div>
        <div><strong>Register</strong>Name and address together</div>
        <div><strong>Verify</strong>Resolution back to your account</div>
      </div>
      <p>This deployment uses VenekoVoxNames with ENSv2 UserRegistries. Its address records are fixed by registration; custom profile fields, resolver editing and theme permissions are not part of this flow. Names expire, and parent-registry administration remains a trust boundary.</p>
      <p>The deployment and a test claim are recorded in the repository’s ENS deployment guide. The page checks its configured deployment before offering registration. Naming is optional and public; it is not personhood, and voting contracts do not read ENS.</p>

      <EditorialArt scene="proof" />
      <h2 id="trust">3. ZKPassport: prove the requirement rather than publish a document</h2>
      <p>
        The phone creates a proof. Our server verifies it and issues a short-lived permission for
        this poll. The chain later checks that permission when you join. Your passport page is not
        uploaded to a public bulletin board.
      </p>
      <p>
        That is still a trust boundary. The issuer can be wrong, slow, or offline. Document support
        depends on ZKPassport and on the country that issued the document. A listed nationality does
        not promise every phone and every document will work. We use a salted unique identifier and
        strict FaceMatch; we do not silently accept mock proofs so a judge can click through.
      </p>
      <p>
        For the flagship poll the cohort is citizenship of the United States, Canada, Australia, or
        an EU member state, age 18+. Nationality is read from the document. It is not inferred from
        IP address or residence. The United Kingdom is not included.
      </p>

      <EditorialArt scene="ballot" />
      <h2 id="maci">4. MACI: seal the ballot, then prove the count</h2>
      <p>
        We did not invent this cryptography.{" "}
        <a href="https://github.com/privacy-scaling-explorations/maci">MACI</a> — Minimal
        Anti-Collusion Infrastructure — is upstream work we fork and integrate. A voter encrypts a
        choice to the coordinator’s public key. The ciphertext goes on-chain. After the poll closes,
        a coordinator publishes a tally with a proof. Anyone can check the proof. Nobody should treat
        “I submitted a transaction” as “my choice was counted.”
      </p>
      <p>
        MACI reduces some coercion and bribery risks; it does not deliver complete immunity. The
        coordinator still sees decrypted ballots at tally time. Public metadata — that you joined,
        that a message was published — remains visible. We state that in the product because hiding
        it would be a worse kind of privacy.
      </p>

      <h2 id="graph">5. The Graph: public information, not a secret count</h2>
      <p>
        Chain events are awkward to read one by one. A subgraph turns them into something a page can
        query: who joined, which messages were published, which state leaves exist. When we join a
        poll we prefer an inclusion proof built from indexed state leaves, then we check the rebuilt
        root before the wallet signs.
      </p>
      <p>
        We also keep a Messari-derived partial governance projection so MACI polls can be read next
        to other governance data. Joined counts and encrypted-message counts are still not results.
        Tally contracts in this stack do not emit a dedicated “here are the totals” event, so we do
        not invent a Graph-shaped result until a verified tally is actually published.
      </p>

      <h2 id="rpc">6. A debugging lesson: the wallet’s RPC is not a read endpoint</h2>
      <p>
        We spent days chasing a <code>CALL_EXCEPTION</code> that looked like a reverted contract. The
        contract was healthy. The wallet’s built-in Sepolia node was rate-limiting a read, and ethers
        reported the throttle as a failed call. The fix was architectural: use an explicit public
        read provider for lookups, and keep the wallet for signatures.
      </p>
      <p>
        The longer write-up lives in the repository as
        <em>Your wallet’s RPC is not a read endpoint</em>. The habit we kept: if the CLI can read
        the contract and the app cannot, suspect the path, not the bytecode.
      </p>

      <h2 id="evidence">7. What is working, what still needs a deployment</h2>
      <p>
        A real passport has produced a real eligibility grant. A real join and a real encrypted
        publish have landed on Sepolia for the France continuity poll. Receipts are checked against
        the Poll contract, not against a stored checkbox. The frontend now renders the operator’s
        actual options and refuses to relabel the original polls as a new question.
      </p>
      <p>
        What is not done: a new flagship poll with three options and a US/Canada/Australia/EU
        allowlist is waiting on Hermes for addresses, dates, and a fresh policy identifier. Verified
        results are waiting on a closed poll and a recoverable coordinator key. Public HTTPS for
        judges still has to work outside an internal network. Evidence beats a green UI tick. Until
        those facts exist, this page will not pretend they do.
      </p>

      <h2 id="vision">8. Recurring conversations, later</h2>
      <p>
        We want this to become a habit: recurring civic questions, richer privacy-protected
        aggregates after Stage 1, and less dependence on a single operator. Those are future work.
        They are not shipped, and they are not prizes we are claiming tonight.
      </p>
      <p>
        For now the promise is smaller and more honest. You don’t have to agree to belong here. You
        should be able to see what was asked, whether you were eligible, whether your encrypted
        message landed, and — when a tally is actually verified — what the count was.
      </p>
      <p>
        <Link to="/polls">Find a poll</Link>
        {" · "}
        <Link to="/names">Get started</Link>
      </p>
    </article>
  );
}
