import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { EditorialArt, type EditorialScene } from "./EditorialArt";

// Explanations describe responsibilities, not completed user or on-chain states.
const chapters: Array<{
  id: string;
  technology: string;
  title: string;
  emphasis: string;
  body: string;
  scene: EditorialScene;
  steps: string[];
  detailTitle: string;
  detail: string;
}> = [
  {
    id: "names",
    technology: "ENSv2 / YOUR NAME",
    title: "A username.",
    emphasis: "In your hands.",
    body: "You shouldn’t need to introduce yourself with a long wallet address. Choose a readable name linked to your account. Our ENS registration creates the name and its address record in one transaction.",
    scene: "introduction",
    steps: ["Choose a name", "Register ownership", "Check it resolves to you"],
    detailTitle: "What are the registry and resolver?",
    detail:
      "Think of the registry as an address book: it records who owns each name. The resolver holds the records that name points to, such as your account address. This deployment sets a fixed address record; it does not offer custom profile records or resolver editing. A name is optional and public; it does not prove you are a unique person or make blockchain activity private.",
  },
  {
    id: "human",
    technology: "ZKPASSPORT / YOUR ELIGIBILITY",
    title: "Prove you’re human.",
    emphasis: "Share less of yourself.",
    body: "Your phone checks your supported passport and creates a cryptographic proof. We verify that proof to check the poll’s requirements and limit repeat participation. You don’t publish your passport to take part.",
    scene: "proof",
    steps: ["Passport checked on phone", "Phone creates proof", "Proof checked for this poll"],
    detailTitle: "What does VenekoVox receive?",
    detail:
      "Our server receives the proof and the requested verification results, not a passport photo. It verifies them and issues a short-lived permission tied to your account and the poll. An internal uniqueness signal helps reject duplicate participation. This is not a claim that no data reaches a server: the issuer still handles verification and account information, and supported documents and devices matter.",
  },
  {
    id: "ballots",
    technology: "MACI + ETHEREUM / YOUR VOTE",
    title: "A private choice.",
    emphasis: "A checkable count.",
    body: "Your browser encrypts your ballot before it is published on Ethereum. After the poll closes, MACI processes the ballots and produces a proof of the tally. The result comes with something to check.",
    scene: "ballot",
    steps: ["Encrypt in your browser", "Publish on Ethereum", "Process ballots + prove tally", "Verify the proof"],
    detailTitle: "How do circuits and censorship resistance fit in?",
    detail:
      "A circuit expresses the counting rules as mathematical checks. A proof shows those checks were satisfied without publishing every individual choice. Ethereum distributes the transaction record across a network, reducing reliance on one operator to preserve it. It is not a guarantee of uninterrupted access: our frontend, eligibility issuer and coordinator can still fail or restrict service. The MACI coordinator can decrypt ballots; public transaction metadata remains visible. A receipt confirms publication, not that a vote was counted.",
  },
  {
    id: "records",
    technology: "THE GRAPH / YOUR EVIDENCE",
    title: "Follow the record.",
    emphasis: "Question the result.",
    body: "Public data is only useful if you can find it. The Graph organizes contract events into readable records. We use those records to prepare join proofs, checking the rebuilt signup-tree root against the chain.",
    scene: "records",
    steps: ["Public contract events", "Indexed records", "Check against the chain"],
    detailTitle: "Are indexed records the final results?",
    detail:
      "No. Joined participants and encrypted messages are not counted votes. The final result needs its own verified tally. Indexing makes public activity easier to inspect; it does not reveal ballot choices or turn a self-selected sample into a representative electorate.",
  },
];

export function TechnologyStory() {
  return (
    <section className="technology-story" id="how-it-works" aria-labelledby="technology-title">
      <header className="technology-intro">
        <p className="story-label">02 / HOW IT WORKS</p>
        <h2 id="technology-title">
          You bring the opinion.
          <br />
          <em>Here’s what we bring.</em>
        </h2>
        <p>
          A name for your account. Proof you can participate.
          <br />
          An encrypted ballot. Evidence behind the count.
        </p>
      </header>
      {chapters.map((chapter, index) => (
        <section
          className={`technology-chapter tech-${chapter.id}`}
          key={chapter.id}
          id={`how-${chapter.id}`}
          aria-labelledby={`title-${chapter.id}`}
        >
          <div className="technology-text">
            <p className="story-label">
              <span className="technology-number">0{index + 1}</span>
              {chapter.technology}
            </p>
            <h3 id={`title-${chapter.id}`}>
              {chapter.title}
              <br />
              <em>{chapter.emphasis}</em>
            </h3>
            <p className="technology-body">{chapter.body}</p>
            <details className="technology-detail">
              <summary>
                {chapter.detailTitle}
                <span aria-hidden="true">+</span>
              </summary>
              <p>{chapter.detail}</p>
            </details>
          </div>
          <EditorialArt scene={chapter.scene} />
          <ol className="technology-flow" aria-label={`${chapter.technology.split(" /")[0]} process`}>
            {chapter.steps.map((step, i) => (
              <li key={step}>
                <span className="flow-number">0{i + 1}</span>
                <span>{step}</span>
                {i < chapter.steps.length - 1 && (
                  <span className="flow-arrow" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      <div className="technology-end">
        <p>Read the mechanics, the trade-offs, and what we’ve verified.</p>
        <Link to="/journal#trust">
          Inside the build <ArrowUpRight size={18} />
        </Link>
      </div>
    </section>
  );
}
