import { Link } from "react-router-dom";
import { ArrowUpRight, Asterisk } from "lucide-react";
import { EditorialArt } from "./EditorialArt";

/** An editorial slate, separate from the deployment-checked ballot in the explorer. */
export function PollBoard({ explorer = false }: { explorer?: boolean }) {
  return (
    <section className="poll-agenda" id="poll-board" aria-labelledby="invitation-title">
      <div className="chapter-caption">
        <span>01 / THE POLLS</span>
        <span>REAL PEOPLE. THEIR OWN OPINIONS.</span>
      </div>
      <div className="agenda-heading">
        <h2 id="invitation-title">Have something to say?</h2>
        <p>Start here.</p>
      </div>
      <article className="flagship-paper">
        <div className="flagship-ribbon">
          <span>THE FLAGSHIP</span>
          <span>AI & SOCIETY / WORLDWIDE PARTICIPATION PLANNED</span>
        </div>
        <div className="flagship-copy">
          <h3>
            Do you support a global ban on developing <em>artificial superintelligence?</em>
          </h3>
          <p>
            AI that exceeds human abilities across almost all intellectual tasks. A development ban, rather than a
            temporary pause.
          </p>
          <ul className="answer-preview" aria-label="Answer options; make your selection on the actual ballot">
            {["Yes", "No", "Unsure"].map((answer) => (
              <li key={answer}>
                <span aria-hidden="true">○</span>
                {answer}
              </li>
            ))}
          </ul>
          <p className="cohort-note">
            <strong>Any country. Your own voice.</strong>
            <br />
            Planned eligibility: age 18+ · supported passport verification.
          </p>
          <Link className="story-button" to="/polls#configured-poll">
            Have your say <ArrowUpRight size={20} />
          </Link>
          <small>
            {explorer
              ? "Preview. Check current availability below; worldwide verification is not yet confirmed here."
              : "Preview. Availability and the active eligibility rules are checked in the poll explorer."}
          </small>
        </div>
        <EditorialArt scene="ai-objects" />
      </article>
      <div className="upcoming-heading">
        <h3>On the horizon</h3>
        <span>UPCOMING / NOT OPEN FOR VOTING</span>
      </div>
      <div className="upcoming-polls">
        <article className="upcoming-paper french-paper">
          <div className="teaser-ribbon">
            <span>FRANCE</span>
            <span>COMING SOON</span>
          </div>
          <EditorialArt scene="france-objects" />
          <div className="upcoming-copy">
            <h3>
              Who would you choose for <em>France’s next president?</em>
            </h3>
            <p className="teaser-options">Candidate slate to be announced</p>
            <p className="cohort-note">
              <strong>Proposed eligibility</strong>
              <br />
              French citizenship · age 18+
            </p>
            <span className="teaser-status">
              Voting opens after configuration <ArrowUpRight size={16} />
            </span>
          </div>
        </article>
        <article className="upcoming-paper brazil-paper">
          <div className="teaser-ribbon">
            <span>BRAZIL</span>
            <span>COMING SOON</span>
          </div>
          <EditorialArt scene="brazil-objects" />
          <div className="upcoming-copy">
            <h3>
              Who would you choose for <em>Brazil’s next president?</em>
            </h3>
            <p className="teaser-options">Candidate slate to be announced</p>
            <p className="cohort-note">
              <strong>Proposed eligibility</strong>
              <br />
              Brazilian citizenship · age 18+
            </p>
            <span className="teaser-status">
              Voting opens after configuration <ArrowUpRight size={16} />
            </span>
          </div>
        </article>
        <article className="upcoming-paper future-paper">
          <div className="teaser-ribbon">
            <span>WHAT’S NEXT</span>
            <span>IN THE MAKING</span>
          </div>
          <div className="future-art" aria-hidden="true">
            <span className="future-question">?</span>
            <span className="future-paper-slip" />
            <Asterisk size={74} strokeWidth={1} />
          </div>
          <div className="upcoming-copy">
            <h3>
              More questions.
              <br />
              <em>More voices.</em>
            </h3>
            <p className="teaser-options">More civic conversations coming soon</p>
            <p className="cohort-note">
              <strong>Eligibility</strong>
              <br />
              Set separately for each future poll
            </p>
            <span className="teaser-status">
              Watch this space <span aria-hidden="true">↗</span>
            </span>
          </div>
        </article>
      </div>
      <p className="agenda-footnote">
        These are independent opinion polls, not official elections or representative population estimates. Upcoming
        eligibility is proposed, not deployed.
      </p>
    </section>
  );
}
