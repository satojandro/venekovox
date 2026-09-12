import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { FieldNote } from "../components/Experience";
import { pollStatusLabel } from "../polls/labels";
import { useConfiguredPoll } from "../polls/useConfiguredPoll";

function windowLabel(configured: ReturnType<typeof useConfiguredPoll>): string {
  if (configured.phase === "loading") return "Checking availability";
  if (configured.phase === "unconfigured") return "Not configured yet";
  if (configured.phase === "partial") {
    return configured.scheduleError === "POLL_MISMATCH" ? "Deployment mismatch" : "Schedule unavailable";
  }
  return pollStatusLabel(configured.schedule.status, "en");
}

export default function Polls() {
  const configured = useConfiguredPoll();
  const descriptor = configured.phase !== "unconfigured" ? configured.descriptor : null;
  const checking = configured.phase === "loading";

  return (
    <main className="section-wrap explorer-page">
      <p className="eyebrow">THE PUBLIC SQUARE / OPINION POLLS</p>
      <div className="section-heading">
        <h1>
          What do
          <br />
          <span>you think?</span>
        </h1>
        <p>
          Curiosity is the starting point.
          <br />
          You bring the perspective.
        </p>
      </div>
      <div className="explorer-grid">
        <section className="poll-feature">
          <div className="card-meta">
            <span>{descriptor?.topic || "CIVIC CONVERSATIONS"}</span>
            <span className="status-pill">{windowLabel(configured)}</span>
          </div>
          <h2>{descriptor?.question.en || "Our next conversation is taking shape."}</h2>
          {checking && <p className="quiet-note">Checking the configured poll on Sepolia…</p>}
          {configured.phase === "unconfigured" && (
            <p>
              No live poll is bound to this app yet. You can still read how the journey works. Voting
              stays unavailable until Hermes publishes a deployment we can check on-chain.
            </p>
          )}
          {descriptor && configured.phase !== "unconfigured" && (
            <>
              <p>{descriptor.eligibilityLabel}</p>
              <div className="ballot-preview" aria-label="Poll options, preview only">
                {descriptor.options.map((option) => (
                  <div key={option.index}>
                    <span className="empty-radio" />
                    {option.label.en}
                  </div>
                ))}
              </div>
              {configured.phase === "ready" ? (
                <Link className="action-primary" to={`/polls/${descriptor.pollId}`}>
                  View question & ballot <ArrowUpRight size={20} />
                </Link>
              ) : (
                <p className="quiet-note">
                  {configured.phase === "partial"
                    ? "The voting window could not be confirmed, so this is not marked Closed. Voting stays unavailable until the schedule can be checked."
                    : "The ballot opens when the on-chain window is confirmed."}
                </p>
              )}
            </>
          )}
          {configured.phase !== "loading" && (
            <button className="text-link refresh-link" type="button" onClick={() => void configured.refresh()}>
              Check availability again
            </button>
          )}
        </section>
        <aside className="explorer-aside">
          <span className="section-index">01 — YOUR FIRST VISIT</span>
          <h3>
            A little preparation.
            <br />
            A meaningful voice.
          </h3>
          <p>Start by claiming your public name. Then check eligibility and open your ballot.</p>
          <Link className="action-secondary" to="/names">
            Start with your name <ArrowRight size={18} />
          </Link>
          <FieldNote title="What will I need?">
            <p>
              A browser wallet on Sepolia, test ETH for network fees, and the ZKPassport app with a
              supported document. Participation depends on this poll’s age and nationality rules. People
              outside that cohort can explore the site but cannot vote.
            </p>
          </FieldNote>
          <FieldNote title="Can I just look around?">
            <p>
              Yes. You can read the question and learn how the system works without connecting a wallet.
            </p>
          </FieldNote>
          <FieldNote title="What do the results represent?">
            <p>
              The people who choose to participate. These are self-selected opinion polls, not
              representative estimates of a country’s population.
            </p>
          </FieldNote>
        </aside>
      </div>
      <Link className="journal-teaser" to="/journal">
        <span>
          <small>FROM THE BUILD JOURNAL</small>
          <strong>
            A name is not a person.
            <br />
            A receipt is not a result.
          </strong>
        </span>
        <ArrowUpRight size={32} />
      </Link>
    </main>
  );
}
