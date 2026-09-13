import { EditorialArt } from "./EditorialArt";

const tensions = [
  {
    title: "Political persecution.",
    body: "Government censorship, surveillance and punishment can make an honest opinion dangerous.",
    answer: "Encrypt the ballot before publication. Keep individual choices off the public record.",
  },
  {
    title: "Social pressure. Ostracism.",
    body: "Fear of exclusion, backlash or cancel culture can turn silence into apparent agreement.",
    answer: "Separate a public account from a publicly readable choice. State the remaining privacy limits clearly.",
  },
  {
    title: "Lack of representation.",
    body: "The people who speak loudest are not everyone. Some perspectives never get asked for.",
    answer:
      "Publish who can participate. Make room for direct answers, without claiming the sample represents everyone.",
  },
  {
    title: "Untrustworthy polling.",
    body: "Opaque methods, inaccurate polls and manipulated counts can shape the opinion they claim to measure.",
    answer: "Define the rules, check eligibility, and publish a tally with evidence that can be verified.",
  },
];

export function ProblemCollage() {
  return (
    <section className="problem-board" id="the-problem" aria-labelledby="manifesto-title">
      <div className="chapter-caption">
        <span>03 / WHY THIS EXISTS</span>
        <span>THE COST OF AN HONEST ANSWER</span>
      </div>
      <div className="problem-heading">
        <h2 id="manifesto-title">
          The pressure is real.
          <br />
          <em>The answer should be yours.</em>
        </h2>
      </div>
      <div className="problem-layout">
        <EditorialArt scene="problem" />
        <div className="problem-notes">
          {tensions.map((item, i) => (
            <article className="problem-note" key={item.title}>
              <span className="story-label">0{i + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
              <details>
                <summary>
                  Our response <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            </article>
          ))}
        </div>
      </div>
      <p className="problem-resolution">
        Encrypted ballots and verifiable counts address part of this problem.
        <br />
        <strong>They are not a promise of safety from every threat.</strong>
      </p>
    </section>
  );
}
