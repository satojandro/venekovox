import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Fingerprint, LockKeyhole, ScanLine } from "lucide-react";
import { FieldNote } from "../components/Experience";

export default function Landing() {
  return (
    <main className="landing-page">
      <section className="hero section-wrap">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="signal-dot" /> HUMAN VOICES. CHECKABLE RESULTS.
          </p>
          <h1>
            Your voice.
            <br />
            <span>On your terms.</span>
          </h1>
          <p className="hero-description">
            You don’t have to agree to belong here. A place for real people to answer the questions that
            matter—with encrypted ballots and evidence you can inspect.
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
            MANY PERSPECTIVES.
            <br />
            <strong>ONE SHARED SPACE.</strong>
          </p>
        </div>
      </section>

      <section className="featured-band section-wrap">
        <div>
          <p className="eyebrow">THE NEXT CONVERSATION / AI & SOCIETY</p>
          <h2>
            Who gets a say
            <br />
            in what comes next?
          </h2>
          <p>
            The debate about superintelligence belongs to people, too. Read the question, explore the
            context, and make up your own mind.
          </p>
        </div>
        <Link className="feature-link" to="/polls">
          <span>Explore the flagship poll</span>
          <ArrowUpRight size={28} />
        </Link>
      </section>

      <section className="section-wrap process-section">
        <div className="section-heading">
          <p className="eyebrow">A LITTLE LESS NOISE. A LITTLE MORE VOICE.</p>
          <h2>
            From your perspective
            <br />
            to a shared picture.
          </h2>
        </div>
        <div className="process-grid">
          {[
            ["01", "A name you own", "Choose a public ENS name for your wallet. Keep control of your profile. A name is not proof that you are a unique person."],
            ["02", "A place at the table", "Use ZKPassport to prove you meet this poll’s requirements. Eligibility is separate from your public name."],
            ["03", "A ballot with privacy", "Your browser encrypts your choice. A transaction receipt lets you check that the message was submitted."],
            ["04", "A count worth checking", "After closing and proof verification, published results can be inspected. A submitted ballot is not yet a counted vote."],
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
          <p className="eyebrow">WHY WE’RE BUILDING</p>
          <h2>
            Being heard shouldn’t
            <br />
            depend on being loud.
          </h2>
          <p>
            When speaking up feels costly and online noise drowns people out, it becomes harder to know
            what anyone actually thinks. We’re building a space for the outspoken, the overlooked, and
            the quietly unconvinced.
          </p>
        </div>
        <Link className="text-link" to="/journal">
          Our story, and what we’ve learned <ArrowUpRight size={18} />
        </Link>
      </section>
    </main>
  );
}
