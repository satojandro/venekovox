import { Link } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Asterisk } from "lucide-react";
import { PollBoard } from "../components/PollBoard";
import { TechnologyStory } from "../components/TechnologyStory";
import { ProblemCollage } from "../components/ProblemCollage";
import "../styles/story.css";

export default function Landing() {
  return (
    <main className="civic-story">
      <section className="story-opening" aria-labelledby="story-title">
        <div className="story-kicker">
          <span>INDEPENDENT VOICES. SHARED QUESTIONS.</span>
          <span>AN EXPERIMENT IN CIVIC TECHNOLOGY</span>
        </div>
        <div className="story-hero-grid">
          <div className="story-hero-copy">
            <p className="story-label">A SMALL REBELLION AGAINST THE MONOLOGUE</p>
            <h1 id="story-title">
              Power loves
              <br />a <em>monologue.</em>
            </h1>
            <p className="hero-reply">
              Give it a conversation<span className="red-period">.</span>
            </p>
            <p className="story-intro">
              Real people. Encrypted ballots. A count you can question.
              <br />
              VenekoVox is a place to disagree — and still be heard.
            </p>
            <div className="story-actions">
              <Link className="story-button" to="/polls">
                Explore the polls <ArrowUpRight size={21} />
              </Link>
              <a className="story-text-link" href="#poll-board">
                See the polls <ArrowDown size={17} />
              </a>
            </div>
          </div>
          <figure className="story-collage">
            <img
              src="/story/voices-collage.png"
              width="1536"
              height="1024"
              alt="Editorial collage: a lone authoritarian figure with a red strip across his eyes faces a diverse gathering of people, encircled in red."
            />
            <figcaption>
              <span>FROM ONE VOICE → TO MANY</span>
              <span>AI-GENERATED EDITORIAL ILLUSTRATION</span>
            </figcaption>
            <div className="collage-stamp" aria-hidden="true">
              MORE
              <br />
              <b>VOICES.</b>
              <Asterisk size={30} />
            </div>
          </figure>
        </div>
        <div className="story-bottom-line">
          <span>PRIVATE, VERIFIABLE CIVIC POLLING</span>
          <span>SCROLL TO OPEN THE CONVERSATION ↓</span>
          <span>SEPOLIA TESTNET</span>
        </div>
      </section>

      <PollBoard />
      <TechnologyStory />
      <ProblemCollage />
      <section className="story-outro">
        <p className="story-label">YOUR VOICE. ON YOUR TERMS.</p>
        <h2>
          You don’t have to agree
          <br />
          to <em>belong here.</em>
        </h2>
        <div>
          <p>
            Read the question. Check the rules.
            <br />
            Make up your own mind.
          </p>
          <Link className="story-button" to="/polls#configured-poll">
            Find your poll <ArrowUpRight size={20} />
          </Link>
        </div>
        <Asterisk className="outro-star" size={130} strokeWidth={1} aria-hidden="true" />
      </section>
    </main>
  );
}
