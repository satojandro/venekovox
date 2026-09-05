# Product vision and requirements

## Purpose

VenekoVox gives people a recurring way to express views on public issues. Its foundation is eligibility backed by identity proofs, private ballot submission, and inspectable aggregate outcomes. The motivation is civic voice and trust, informed by Alejandro's experience growing up in Venezuela.

A successful product lets a person understand what they are answering, why they qualify, what information they disclose, and what happens after submission. Technology and prize integrations must support this journey.

## People and their jobs

| Person                | Job                                                        | Required outcome                                                                |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Participant           | Express a view without publicly publishing a ballot choice | Clear eligibility, private submission, reliable recovery and confirmation       |
| Returning participant | Follow issues over time                                    | Recognizable profile, previous participation state and published results        |
| Poll creator          | Ask a clear, current question of a defined group           | Immutable choices, eligibility and schedule; a reachable audience               |
| Reader / researcher   | Understand what participants said                          | Provenance, methodology, sample size, finality and limitations                  |
| Operator              | Keep verification, proving and indexing functioning        | Reproducible deployment, recovery and evidence checkpoints                      |
| Agent                 | Help users discover, interpret or create polls             | Same public data and creation rules as other clients; no human-ballot authority |

## First complete journey (M1)

1. Open one real poll. Read its question, choices, eligibility, schedule and privacy explanation. Clearly distinguish demonstration content from real data.
2. Connect an account. The eventual default should avoid wallet installation and manual gas funding; an injected wallet remains a fallback.
3. Verify the required eligibility through Self Pass. Explain requested disclosures before scanning. Verification failure offers a recoverable path.
4. Authorize the actual participating account under the poll's policy. A UI success flag is insufficient.
5. Submit a choice. The application handles signup, poll membership and encrypted publish, exposes understandable progress, and prevents duplicate concurrent actions.
6. Refresh or reconnect. Recover chain-backed participation and transaction status without showing another account's state. Explain key loss separately from wallet disconnection.
7. After closing, return to proof-verified aggregate results. Show tally/indexing progress while results are unavailable.

A CLI/operator-created poll is acceptable for M1. A complete public creation flow is a later milestone. Smart-wallet compatibility and eligibility binding must be decided together before a final M1 policy deployment.

## Experience principles

- Use ordinary language: “Verify eligibility”, “Submit privately”, “Submission confirmed”, “Results being verified”. Technical detail belongs in expandable evidence views.
- Never turn a network error into “you are not registered”, an empty dataset into zero votes, or a stored hash into proof of confirmation.
- Distinguish proof verification, registration, membership, submitted messages and counted outcomes. They are different events and may have different counts.
- Preserve progress across refresh and wallet changes; do not silently generate a replacement voting identity when recovery was intended.
- Make public profile linkage explicit. ENS names are persistent pseudonyms, not an anonymity guarantee.
- Spanish and English matter to the intended audience. Verify actual translated journeys before claiming full multilingual support.
- Gas sponsorship should make the eligible path usable with zero ETH. Failures must explain how to retry without unexpected payment prompts.

## Long-term shape

M2 adds poll creation/discovery, persistent ENS profiles, and dependable onboarding. M3 adds standardized public data, natural-language queries, and constrained agent creation. M4 adds resource panels and discussions with moderation, provenance and separation from ballot choices.

An agent monitoring news can suggest a question and supporting sources. Initial automated creation should be bounded by quotas, duplicate detection and a review policy. The creator's identity and source provenance should be visible; generated framing should not masquerade as neutral fact.

Discussion participation must not be automatically linked to a secret ballot. Do not collect vote reasons, expose small demographic result slices, or monetize individual opinions as part of the initial privacy promise.

## Boundaries and success measures

Verification limits one kind of duplicate participation; it does not establish representative sampling, informed consent to every use, or the correctness of a poll's framing. Eligibility may exclude people without supported documents. Report these limitations with the result.

Measure completion rate, time to first submission, verification failures, proof-generation failures, transaction failures, refresh recovery, time to final results, and repeat participation. Collect minimal operational telemetry without ballot choices, identity documents, secret keys or raw verification payloads.

The release gate is a demonstrated complete journey, not a target metric invented without observations. Record measured values and device/network conditions during smoke tests.
