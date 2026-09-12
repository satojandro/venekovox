# A name is not a person. A receipt is not a result.

_September 2026 — VenekoVox build journal. Readable without a crypto background._

Standfirst: what we learned building a place for real voices and checkable votes — and
what is still waiting on a deployment we can point to.

This article is also served at `/journal`. Privacy details are anchored at
`/journal#trust`.

## 1. Why civic voice needs something better than loudness

Online conversation rewards volume. The people who shout, post often, or already have a
following are easy to hear. The people who hesitate — because speech feels costly, or
because they are simply drowned out — disappear into the noise. We wanted a shared
question that real people could answer, and a count that someone else could check.

That is a product problem, not a slogan. Eligibility has to mean a person meeting a
rule, not a wallet that showed up. A ballot has to stay private while it is open. A
result has to be more than a green tick in a user interface. None of those jobs is done
by a trending topic.

## 2. ENSv2: a name is a public profile

Think of three pieces. A **registry** is a neighbourhood address book: it says which
label belongs to which account. A **resolver** is the profile record behind that
label — the address, the theme, whatever the owner chose to publish. A **scoped
permission** is the right to edit one field, not the keys to the whole house.

Our Sepolia path uses a UserRegistry for people names, a Permissioned Resolver the
owner controls, and Ethereum Access Control so a registrar can register a label without
later rewriting the owner’s address. That last point matters: in this design the
registrar cannot silently retarget a name after you claim it.

Naming is deployed as candidate contracts and frontend onboarding on a separate
branch. Live parent names and a public HTTPS demo of claiming still depend on operator
setup. A name is optional. It is not personhood, and voting contracts do not read ENS.

## 3. ZKPassport: prove the requirement rather than publish a document

The phone creates a proof. Our server verifies it and issues a short-lived permission
for this poll. The chain later checks that permission when you join. Your passport page
is not uploaded to a public bulletin board.

That is still a trust boundary. The issuer can be wrong, slow, or offline. Document
support depends on ZKPassport and on the country that issued the document. A listed
nationality does not promise every phone and every document will work. We use a salted
unique identifier and strict FaceMatch; we do not silently accept mock proofs so a
judge can click through.

For the flagship poll the cohort is citizenship of the United States, Canada, Australia,
or an EU member state, age 18+. Nationality is read from the document. It is not
inferred from IP address or residence. The United Kingdom is not included.

## 4. MACI: seal the ballot, then prove the count

We did not invent this cryptography. [MACI](https://github.com/privacy-scaling-explorations/maci)
— Minimal Anti-Collusion Infrastructure — is upstream work we fork and integrate. A
voter encrypts a choice to the coordinator’s public key. The ciphertext goes on-chain.
After the poll closes, a coordinator publishes a tally with a proof. Anyone can check
the proof. Nobody should treat “I submitted a transaction” as “my choice was counted.”

MACI reduces some coercion and bribery risks; it does not deliver complete immunity.
The coordinator still sees decrypted ballots at tally time. Public metadata — that you
joined, that a message was published — remains visible. We state that in the product
because hiding it would be a worse kind of privacy.

## 5. The Graph: public information, not a secret count

Chain events are awkward to read one by one. A subgraph turns them into something a
page can query: who joined, which messages were published, which state leaves exist.
When we join a poll we prefer an inclusion proof built from indexed state leaves, then
we check the rebuilt root before the wallet signs.

We also keep a Messari-derived partial governance projection so MACI polls can be read
next to other governance data. Joined counts and encrypted-message counts are still
not results. Tally contracts in this stack do not emit a dedicated “here are the
totals” event, so we do not invent a Graph-shaped result until a verified tally is
actually published.

## 6. A debugging lesson: the wallet’s RPC is not a read endpoint

We spent days chasing a `CALL_EXCEPTION` that looked like a reverted contract. The
contract was healthy. The wallet’s built-in Sepolia node was rate-limiting a read, and
ethers reported the throttle as a failed call. The fix was architectural: use an
explicit public read provider for lookups, and keep the wallet for signatures.

See [Your wallet’s RPC is not a read endpoint](2026-09-11-wallet-rpc-is-not-a-read-endpoint.md).
The habit we kept: if the CLI can read the contract and the app cannot, suspect the
path, not the bytecode.

## 7. What is working, what still needs a deployment

A real passport has produced a real eligibility grant. A real join and a real encrypted
publish have landed on Sepolia for the France continuity poll. Receipts are checked
against the Poll contract, not against a stored checkbox. The frontend now renders the
operator’s actual options and refuses to relabel the original polls as a new question.

What is not done: a new flagship poll with three options and a
US/Canada/Australia/EU allowlist is waiting on Hermes for addresses, dates, and a
fresh policy identifier. Verified results are waiting on a closed poll and a
recoverable coordinator key. Public HTTPS for judges still has to work outside an
internal network. Evidence beats a green UI tick. Until those facts exist, this page
will not pretend they do.

## 8. Recurring conversations, later

We want this to become a habit: recurring civic questions, richer privacy-protected
aggregates after Stage 1, and less dependence on a single operator. Those are future
work. They are not shipped, and they are not prizes we are claiming tonight.

For now the promise is smaller and more honest. You don’t have to agree to belong
here. You should be able to see what was asked, whether you were eligible, whether
your encrypted message landed, and — when a tally is actually verified — what the
count was.
