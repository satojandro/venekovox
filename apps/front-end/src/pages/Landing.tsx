import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Fingerprint, LockKeyhole, ScanLine } from "lucide-react";
import { FieldNote } from "../components/Experience";

export default function Landing() {
  return (
    <main className="landing-page">
      <section className="hero section-wrap">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="signal-dot" /> MACI · ZKPASSPORT · ENS
          </p>
          <h1 className="hero-title">
            Real Polls.
            <br />
            Real People.
            <br />
            <span>Private &amp; Censorship Resistant.</span>
          </h1>
          <p className="hero-description">
            One person, one vote. Encrypted in the browser. Posted where it cannot be quietly deleted.
            Counted with evidence you can check.
          </p>
          <div className="action-row">
            <Link className="action-primary" to="/polls">
              Find a poll <ArrowUpRight size={20} />
            </Link>
            <Link className="text-link" to="/names">
              Get started <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-notes">
            <span>
              <Fingerprint size={15} /> Eligibility checked
            </span>
            <span>
              <LockKeyhole size={15} /> Ballots encrypted
            </span>
            <span>
              <ScanLine size={15} /> Tally evidence
            </span>
          </div>
        </div>
        <div className="voice-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-cross cross-one">+</div>
          <div className="art-cross cross-two">+</div>
          <div className="ballot-glass glass-back" />
          <div className="ballot-glass glass-front">
            <span className="ballot-lines">
              ● ━━━━━
              <br />○ ━━━━
              <br />○ ━━━━━
            </span>
            <span className="art-check">↗</span>
          </div>
          <p className="art-caption">
            ONE PERSON. ONE VOTE.
            <br />
            <strong>NOBODY READS THE BALLOT.</strong>
          </p>
        </div>
      </section>

      <section className="featured-band section-wrap">
        <div>
          <p className="eyebrow">FLAGSHIP POLL · AI &amp; SOCIETY</p>
          <h2>
            Do you support a global ban
            <br />
            on artificial superintelligence?
          </h2>
          <p>
            Citizens of the US, Canada, Australia, and the EU, age 18 and over. Three options. Equal
            weight. Encrypted until the verified tally.
          </p>
        </div>
        <Link className="feature-link" to="/polls">
          <span>Explore the flagship poll</span>
          <ArrowUpRight size={28} />
        </Link>
      </section>

      <section className="section-wrap process-section">
        <div className="section-heading">
          <p className="eyebrow">HOW A VOTE ACTUALLY WORKS</p>
          <h2>
            Name. Eligibility.
            <br />
            Encrypted ballot. Checkable tally.
          </h2>
        </div>
        <div className="process-grid">
          {[
            ["01", "A name you control", "Register a public ENS name on the wallet. A name is a handle. It is not proof that you are a unique person."],
            ["02", "Prove you are eligible", "ZKPassport checks this poll’s age and nationality rules. Eligibility is separate from the public name."],
            ["03", "Encrypt the ballot", "The browser encrypts the choice. The chain records a message, not a readable vote. Nobody can quietly delete that publication."],
            ["04", "Check the tally", "After close and proof verification, published results can be inspected. A submitted ballot is not yet a counted vote."],
          ].map(([n, title, body]) => (
            <article key={n}>
              <span className="step-number">{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="setup-list">
          <FieldNote title="What you’ll need (Sepolia testnet)">
            <p>
              A browser wallet on Sepolia, a little test ETH for network fees, the ZKPassport phone app,
              and a supported identity document. You must meet this poll’s age and nationality rules to
              vote. You can read the question without connecting a wallet.
            </p>
          </FieldNote>
        </div>
      </section>

      <section className="story-band section-wrap">
        <div>
          <p className="eyebrow">WHY THIS STACK</p>
          <h2>
            Speech gets silenced.
            <br />
            Counts get faked.
          </h2>
          <p>
            Printers were licensed. Mail was opened. Ballots were stuffed. Feeds are filtered. The
            answer is not a nicer comment section. It is a unique human, an encrypted ballot, and a
            tally that can be checked.
          </p>
        </div>
        <Link className="text-link" to="/journal">
          Our argument, in writing <ArrowUpRight size={18} />
        </Link>
      </section>
    </main>
  );
}
