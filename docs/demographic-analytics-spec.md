# Demographic analytics: product direction and architecture requirements

**Project:** VenekoVox · **Version:** 0.1 · **Decision date:** 2026-09-05  
**Suggested repository path:** `docs/demographic-analytics-spec.md`  
**Status:** Accepted product direction; proposed technical design. No implementation or live verification is established by this document.  
**Product owner:** Alejandro. Implementation owner: assign at pickup.

## 1. Decision and purpose

VenekoVox should support privacy-preserving demographic research alongside private civic voting. The long-term product may offer paid access to approved aggregate reports, comparisons, trends and APIs. Nationality, age bands and carefully defined document-derived or self-reported attributes are initial candidates.

This capability is **outside the seven-day release's required implementation scope**, but **inside the long-term product scope**. Work this week should preserve a feasible extension path without committing to an unreviewed cryptographic design or collecting unnecessary data “just in case”.

The seven-day objective remains a complete verified-human → contract authorization → private submission → verified aggregate results journey. This document adds design constraints to that work; it does not replace its acceptance gates.

### Relationship to earlier documents

This supersedes any interpretation of `decisions.md` or `product-vision.md` that demographic analytics is permanently excluded. Earlier deferral of demographic microsegments remains applicable to the initial release. Individual political-opinion records are not the proposed commercial product.

When integrating, link this document from `docs/README.md`, `roadmap.md`, `integration-spec.md`, `decisions.md` and `agent-handoff.md`. Update their scope language to distinguish “deferred implementation” from “excluded capability”. Do not mark any roadmap feature implemented merely because this spec exists.

## 2. Product outputs and their different requirements

| Output                         | Example                                                | Required evidence                                                                       |
| ------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Community composition          | Nationality distribution of verified community members | Deduplicated, appropriately consented verification records                              |
| Poll participation composition | Age distribution of people who joined a poll           | Authenticated linkage to the specifically defined participation event                   |
| Demographic ballot outcomes    | Support/opposition by nationality                      | Authenticated linkage to valid final counted ballots, with aggregate release protection |

Registration, joining, encrypted message submission and counted participation are distinct populations. A person may join without voting or submit multiple commands. Every report must define its denominator and treatment of missing data.

Do not relabel a profile-distribution chart as a demographic voting result. Do not count MACI encrypted-message entities as unique voters.

## 3. Current evidence boundary

The last repository baseline reviewed for architecture was `7fce1e185a2d24a38e20a56bb99f900a07df2cef`. No newer remote audit is claimed here. Before implementation, inspect current main and reconcile changes.

At that snapshot:

- `apps/front-end/src/pages/Auth.tsx` requested Self nationality and gender disclosures plus a minimum-age check of 18.
- `apps/backend/src/routes/verify.ts` returned those attributes, a nullifier and the full disclosure output; it logged some identity metadata.
- A minimum-age check did not establish detailed age bands.
- The Self-to-MACI contract authorization bridge was incomplete.
- Demographic ballot aggregation, a privacy release service and premium analytics were not demonstrated.

These existing disclosures are not evidence of consent, safe storage, anonymity, authenticated ballot linkage or production readiness. Review response shaping and logging before adding collection.

## 4. Attribute semantics and collection policy

Self's official integration example supports selective disclosure controls including nationality, date of birth and a field named `gender`, as well as minimum-age requirements. Migration note (2026-09-05, D02): Self Pass is legacy and the user selected Enterprise. This historical SDK example is not a current integration recipe. Re-evaluate Enterprise disclosure controls, custody and supported documents before implementing analytics; do not enable demographic reveals on the minimal eligibility flow. [Self integration example](https://github.com/selfxyz/self-integration-boilerplate)

| Attribute                          | Intended representation                                       | Requirements                                                                                               |
| ---------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Nationality                        | Normalized document-verified value plus source/version        | Not current residence, ethnicity or an exhaustive list of citizenships; support unknown/unsupported values |
| Age                                | Band defined by a versioned policy at a stated reference date | Prefer a supported range proof; never infer an age band from an 18+ result alone                           |
| Document sex/gender field          | Precisely labelled source-derived category                    | Do not silently equate document values with self-described gender; preserve unknown/unsupported categories |
| Self-described gender or residence | Optional survey answer, if introduced                         | Mark self-reported; do not describe it as document verified                                                |
| Name, document number              | Not requested for analytics                                   | Do not retain raw document images or full disclosure payloads for this purpose                             |

An age-band proof is a capability to verify, not an assumed feature. If the verifier receives date of birth to compute a band, the verifier sees it even if it discards it immediately. That fallback requires an explicit trust/consent decision. Never upload a full date of birth to the public chain merely to simplify bucketing.

Store attribute provenance, policy version and reference date only as needed. Define expiry and re-verification. A participant aging into a new band must not silently alter a historical poll. Dual documents, document renewal and multiple wallets need an explicit uniqueness policy; a nullifier must not be assumed to solve every identity-duplication case.

### Participation and consent

Separate information strictly required for eligibility from optional analytics contributions. Specify what declining analytics means; preferred direction is that optional demographic contribution does not prevent otherwise eligible voting. Missing attributes remain missing rather than being inferred.

Explain which attributes are received, who can see them, intended aggregate commercial use, retention and withdrawal behavior before collection. Determine applicable data obligations before a real paid release. Withdrawal cannot retract already downloaded or published aggregate reports; do not promise otherwise. Define any conflict between deletion and retained proof/audit evidence before collecting that evidence.

## 5. Privacy and threat model

Removing a name produces pseudonymous data, not necessarily anonymous data. Nationality, age, timestamps, public wallets and ENS names can combine into identifying information.

Standard MACI permits the coordinator to decrypt voting commands. Public ballot confidentiality does not imply confidentiality from the coordinator. [MACI project description](https://pse.dev/projects/maci)

| Actor                    | Permitted knowledge depends on selected design             | Main risk to address                                                |
| ------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| Verification service     | Requested disclosures and authorization context            | Attribute/account linkage, raw payload logging, excessive retention |
| MACI coordinator         | Decrypted commands under standard MACI                     | Linking political choices to demographic or account records         |
| Analytics service        | Approved inputs or aggregates under its chosen trust model | Row-level joins, unauthorized queries and operator compromise       |
| Public observers         | Chain metadata, public outputs, ENS records                | Re-identification and reconstruction from public data               |
| Premium customer / agent | Approved aggregate outputs only                            | Differencing, collusion across accounts and excessive filtering     |

Service separation reduces exposure but does not prove unlinkability when operators can collude or observe shared IDs/timing. A hash of nationality/age/gender is guessable; do not use unsalted low-entropy hashes as “private” commitments. A cryptographic commitment design needs appropriate randomness, domain separation and reviewed primitives.

**Required distinction:** connect authenticated attributes to a counted ballot within the chosen trusted/proven computation; do not publish individual attribute-choice connections.

## 6. Implementation options

| Option                                           | Mechanism                                                                                                     | What can be claimed                                                         | Indicative effort                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| A: trusted analytics prototype                   | Controlled linkage of verified attributes to final valid ballots; coordinator/service computes breakdowns     | Operator-computed demographic report; not automatically MACI-proof-verified | Potentially days to a limited prototype after the core journey works; production controls take longer |
| B: proof-backed demographic tally                | A credential/commitment authenticates cohort membership; a proof binds breakdowns to final valid ballot state | Only the demographic properties explicitly checked by the new proof         | Multi-week engineering at minimum, plus specialist review; estimate after spike                       |
| C: no single operator sees attribute-choice rows | Additional secure/distributed computation and key-management design                                           | Stronger confidentiality only under the new protocol's stated assumptions   | Research and operational project; not a seven-day deliverable                                         |

These estimates are planning judgments, not commitments. Options are not guaranteed drop-in upgrades. In particular, adding a proof to option A does not erase data already exposed to its operator or automatically achieve option C.

A separate proof layer might avoid modifying every MACI circuit. It must still bind attributes and counts to the authoritative final state, including key updates, invalid commands, vote changes, credits/mode, abstentions and uniqueness. A valid overall tally proof does not automatically validate a demographic join performed afterward.

Do not encode unchecked demographic claims as extra ballot choices, rely on self-selected cohorts as verified facts, or deploy separate public demographic polls as a privacy-equivalent shortcut. Such designs change ballot semantics or reveal membership and need independent analysis.

## 7. Target boundaries

This is a conceptual target, not an implemented topology. The proof/trust mechanism for the central connection remains undecided.

```
  DEMOGRAPHIC ANALYTICS — TARGET BOUNDARIES (conceptual, not implemented)

   Participant
        │
        ▼
   Self verification
        │
        ├───────────────────────────────┐
        ▼                               ▼
   Eligibility authorization      Consented attribute credential
        │                               │
        ▼                               │
   MACI participation                   │
   and commands                         │
        │                               │
        ▼                               ▼
   Final valid ballot state ─────> Controlled or proven
                                   cohort computation
                                        │
                                        ▼
                                   Privacy release policy
                                        │
                        ┌───────────────┴───────────────┐
                        ▼                               ▼
                 Public approved                 Premium approved
                 aggregates                      aggregates
                        │                               │
                        ▼                               ▼
                 Graph and public UI            Authenticated
                                                analytics API
```

Do not place individual demographic records, private credentials, identity nullifiers or attribute-choice rows into ENS records, public metadata, logs or a public subgraph. Keep wallet execution, eligibility and analytics behind separate interfaces even if an early prototype shares infrastructure.

## 8. Contracts to preserve this week

The following are **logical interface requirements**, not instructions to create unused databases or deploy a new credential protocol immediately.

| Contract                     | Minimum design requirements                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Analytics policy             | Version, requested fields, required versus optional, bucket definitions, reference date, intended use, trust model and release-policy version        |
| Attribute evidence           | Issuer/verification method, schema version, validity and scoped binding appropriate to the chosen design; no raw identity material in public outputs |
| Poll analytics configuration | Poll context, policy reference, allowed dimensions, ballot semantics and implementation version; explicit `disabled` supported                       |
| Report provenance            | Poll/tally context, denominator, attribute coverage, method, source commitment where applicable, verification kind, release version and finality     |
| Report availability          | Distinguish unavailable, not collected, processing, suppressed and released; null/withheld is not numeric zero                                       |

Suggested verification labels: `operator_computed`, `proof_verified`, `synthetic_demo`. They must describe demographic computation, separately from whether the overall MACI tally is verified. No label implies operator-private computation without an explicit threat model.

Enforcement must bind the actual participating account, including a smart account rather than merely its signer. Do not use a public persistent ENS name as the analytics join key. Poll-scoped identifiers alone do not make a public wallet unlinkable.

### Upgrade and historical-data rules

- Version policy, credentials, bucket definitions, result schema and tally implementation independently where their semantics differ.
- Keep historical polls and their interpretation stable. Future polls can use newly deployed contracts; proxy upgradeability is not required everywhere.
- Re-verification and fresh consent may be necessary after an upgrade. Do not silently broaden the use of earlier records.
- Old overall aggregates cannot yield demographic ballot breakdowns if the necessary authenticated inputs were never collected or retained.
- Even retained coarse bands cannot support arbitrary future age ranges. Document unavailable historical dimensions honestly.
- Preserve extension interfaces rather than collecting surplus sensitive data to avoid every possible future migration.

## 9. Aggregate release protection

A minimum cohort size is one control, not a general anonymity guarantee. Attackers can subtract known cohorts from the total, compare overlapping filters, or compare releases over time. A unanimous large cohort can also reveal every member's answer if membership is known.

Initial release design should use predefined dimensions and fixed post-close snapshots. Include small-cell suppression, complementary suppression, handling of revealing homogeneous groups, and restrictions on intersections. No universal threshold is approved here; select it through a concrete release-risk analysis.

Treat all customer and agent access paths as one release surface. Do not offer looser privacy rules to premium tiers or let customers bypass limits by creating another account. Rate limiting alone does not prevent inference.

For more interactive analysis, evaluate differential privacy: bounded per-person contribution, a defined privacy unit, noise mechanism, composition/privacy budget and consistent treatment of repeated requests. Adding fresh independent noise to unlimited requests can let customers average it away. Differential privacy addresses disclosure risk, not sampling bias. [NIST introduction](https://www.nist.gov/blogs/cybersecurity-insights/differential-privacy-privacy-preserving-data-analysis-introduction-our)

If outputs are perturbed, report that clearly. An exact internal verified count and a privacy-protected released estimate are different objects; neither should be mislabeled. A cryptographic proof or public commitment does not by itself establish an adequate release policy.

## 10. Commercial data boundary

Premium value may include approved demographic reports, comparisons, longitudinal analysis, exports and API access. The public layer can expose general metadata, overall outcomes and selected evidence. The private service applies authentication, entitlement and the same privacy release policy before responding.

Plaintext data published on-chain or in a public subgraph can be copied. A paid UI or x402 gateway cannot make already-public information exclusive. Public commitments may anchor private reports; they do not alone prove correct analysis. Customers can also redistribute purchased outputs, so do not assume a paywall guarantees confidentiality or prevents extraction.

Raw person-level political records and wallet-linked opinions are outside this proposed premium product. Future agents receive approved aggregates through the same release service, not direct privileged database access.

Commercial credibility also requires recruitment and sampling methodology, transparent questions, coverage/missingness reporting and justified weighting. Unique document verification does not make an opt-in sample representative. Weighting must be versioned and distinguished from raw counts; do not promise a conventional population margin of error without a defensible design. [AAPOR best practices](https://aapor.org/standards-and-ethics/best-practices/)

## 11. Delivery plan and acceptance gates

### DA0 — Seven-day release: preserve the option

Budget a bounded design/schema effort, approximately one to two days, around existing critical-path work. Reassess with the implementation owner; this is not permission to displace core end-to-end acceptance.

- [ ] Link this spec and reconcile earlier deferred/excluded scope language.
- [ ] Inspect latest Self disclosures/logging and actual account/policy binding.
- [ ] Define attributes and required/optional status; keep analytics disabled where policy is unresolved.
- [ ] Record versioning and report-status interfaces; mark unavailable demographic data honestly.
- [ ] Keep individual records off public chain/Graph/ENS and separate from ordinary telemetry.
- [ ] Document that historical polls may lack demographic analysis and require a future deployment/re-verification.
- [ ] Demonstrate core polling without claiming demographic results are implemented.

Optional demo: synthetic report with a prominent synthetic label. A real consenting test cohort requires an explicit trusted-analytics design and release review first; a chart mockup is not acceptance evidence.

### DA1 — Post-hackathon feasibility spike

- Confirm exact Self age-range/disclosure behavior and multi-document/nullifier limitations.
- Compare A/B/C against who must be unable to see individual attribute-choice linkage.
- Trace the final MACI ballot state and identify an authenticated attribute-binding mechanism.
- Produce a data-flow/threat model, proof statement if relevant, migration plan and effort estimate.
- Choose one release product and adversarial query examples before building a general analytics explorer.

### DA2 — Controlled analytics pilot

Test tampered attributes, wrong poll/account, duplicate credentials, key/wallet recovery, vote updates, missing demographics and denominator correctness. Verify report integrity separately from overall tally correctness. Test suppression against subtraction, overlapping filters, homogeneous cohorts and repeated snapshots. Record consent, retention and operator-access behavior without retaining raw documents as evidence.

### DA3 — Proof-backed and commercial release

Require review of the implemented proof/trust model, release policy, access controls and applicable data obligations. Verify that paid/agent access cannot reveal raw records or bypass release controls. Publish methodology and limitations. Expand dimensions only after evaluating their joint disclosure risk and statistical usefulness.

## 12. Resume checklist and unresolved decisions

| Decision                                                                       | Status / owner at pickup                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Who must not see attribute-choice linkage: public, customer, operator, or all? | Unresolved; product owner with security design input    |
| Analytics participation optionality and consent wording                        | Preferred optional; finalize before collection          |
| Exact age bands, reference date and supported range proof                      | Unresolved; SDK/proof spike                             |
| Nationality, document field and self-reported attribute definitions            | Proposed in section 4; verify source semantics          |
| Credential, uniqueness and account-recovery mechanism                          | Unresolved; coordinate with P2/W1                       |
| Trusted versus proof-backed demographic computation                            | Unresolved; no protocol selection implied               |
| Release thresholds, intersections and differential-privacy policy              | Unresolved; no arbitrary default is production-approved |
| Retention, deletion, proof evidence and old-report handling                    | Unresolved; settle before real collection               |
| Public versus premium report catalogue                                         | Proposed split; commercial validation pending           |

At pickup: read current main, identify the implementation owner, record the baseline SHA and chosen DA task, and resolve its dependencies. At handoff: record changed paths, accepted decisions, tests/evidence, unresolved privacy assumptions and the next concrete action. Do not infer production status from this document's detail.

## 13. Source and verification note

Sources above were consulted during the preceding design discussion on 2026-09-05. They support general capabilities and constraints, not a claim that a particular deployment or custom demographic proof has been validated. Pin and recheck relevant versions when implementation resumes. The architecture, phases and effort ranges are VenekoVox design proposals.
