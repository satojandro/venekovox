import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { screens, type ScreenId } from "./screens";

export const action = "inline-block bg-lime-300 text-black rounded-lg px-5 py-3 font-medium disabled:opacity-40";
const input = "w-full bg-gray-900 border border-gray-600 rounded-lg p-3";
export function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <nav aria-label="Main navigation" className="flex flex-wrap gap-5 text-lime-300">
          <Link to="/">VenekoVox</Link>
          <Link to="/polls">Polls</Link>
          <Link to="/account">Account</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/journey">Screen map</Link>
        </nav>
        <header>
          <p className="text-lime-300 tracking-widest text-sm">VENEKOVOX / PRIVATE POLLING / STAGE 1</p>
          <h1 className="text-4xl font-bold my-4">{title}</h1>
        </header>
        {children}
        <footer className="border-t border-gray-800 pt-6 text-sm text-gray-400">
          <Link to="/help/privacy" className="underline">
            Privacy, trust and recovery
          </Link>
          <p className="mt-2">
            Development round · Sepolia. Availability of a screen does not mean its service is connected.
          </p>
        </footer>
      </div>
    </main>
  );
}
function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-gray-700 rounded-xl p-6 space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Pending({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="border border-amber-600 rounded-lg p-4 text-amber-200">
      {children}
    </p>
  );
}
function Unavailable({ label, reason }: { label: string; reason: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-3">
      <button className={action} onClick={() => setShow(true)}>
        {label}
      </button>
      {show && <Pending>{reason}</Pending>}
    </div>
  );
}
export function RoundHome() {
  return (
    <Shell title="A voice. A private vote.">
      <p className="text-lg text-gray-300">
        Explore polls, prepare your account and follow a private voting round through to verified results.
      </p>
      <Link className={action} to="/login">
        Log in with Privy
      </Link>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card title="Participate">
          <p>Browse → log in → optional ENS name → verify ID → vote → check results.</p>
          <Link className="text-lime-300 underline" to="/polls">
            Explore polls →
          </Link>
        </Card>
        <Card title="Administer">
          <p>Log in → create → review and publish → coordinate → release verified results.</p>
          <Link className="text-lime-300 underline" to="/admin">
            Open admin workspace →
          </Link>
        </Card>
      </div>
      <Pending>
        This frontend round is ready to explore. Privy login and the new write actions are awaiting integration; no
        identity, name, vote or deployment success is simulated.
      </Pending>
      <Link to="/journey" className="text-lime-300 underline">
        See every screen and its wiring notes →
      </Link>
    </Shell>
  );
}
export function ScreenMap() {
  return (
    <Shell title="The complete round">
      <p>Choose a screen to inspect it. Developer notes list the remaining connection on each screen.</p>
      <Card title="Public entry points">
        <div className="flex flex-wrap gap-5 text-lime-300 underline">
          <Link to="/">Home / login</Link>
          <Link to="/polls">Poll list</Link>
          <Link to="/discover">ENS poll discovery</Link>
        </div>
        <p>Poll cards open the existing configured poll detail with its live schedule reader.</p>
      </Card>
      {["voter", "admin", "shared"].map((area) => (
        <section key={area} className="space-y-3">
          <h2 className="text-2xl capitalize">{area === "voter" ? "Participant" : area} path</h2>
          <ol className="space-y-3">
            {screens
              .filter((s) => s.area === area)
              .map((s, i) => (
                <li key={s.id} className="border border-gray-700 rounded-xl p-5">
                  <Link className="text-lime-300 text-lg underline" to={s.path}>
                    {i + 1}. {s.title}
                  </Link>
                  <p className="text-gray-300 mt-2">{s.components}</p>
                  <details className="mt-3 text-sm text-gray-400">
                    <summary className="cursor-pointer">Backend / wiring handoff</summary>
                    <p className="mt-2">{s.wiring}</p>
                  </details>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </Shell>
  );
}
function Draft() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [context, setContext] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  // UI-only, intentionally memory-only: no client draft confers admin permissions.
  return (
    <Card title="Draft a question">
      <p>This draft stays on this page and is lost when you leave or refresh. Deployment is not connected.</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setReview(false);
          const startMs = Date.parse(start + "Z");
          const endMs = Date.parse(end + "Z");
          if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs <= Date.now() || endMs <= startMs) {
            setError("Choose a future start and an end after the start. All dates are UTC.");
            return;
          }
          if (
            !question.trim() ||
            options.some((o) => !o.trim()) ||
            new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length
          ) {
            setError("Enter a question and at least two distinct, non-empty options.");
            return;
          }
          setError("");
          setReview(true);
        }}
        onChange={() => setReview(false)}
      >
        <label className="block">
          Question
          <input
            className={input}
            required
            maxLength={280}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className="block">
          Context / explanation
          <textarea className={input} maxLength={4000} value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
        <fieldset className="space-y-3">
          <legend>Ordered ballot options</legend>
          {options.map((value, i) => (
            <div key={i} className="flex gap-2">
              <label className="flex-1">
                Option {i + 1}
                <input
                  className={input}
                  required
                  maxLength={160}
                  value={value}
                  onChange={(e) => setOptions(options.map((o, j) => (i === j ? e.target.value : o)))}
                />
              </label>
              <button
                type="button"
                className="underline text-gray-300"
                disabled={options.length <= 2}
                onClick={() => {
                  setOptions(options.filter((_, j) => i !== j));
                  setReview(false);
                }}
                aria-label={`Remove option ${i + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-lime-300 underline"
            disabled={options.length >= 8}
            onClick={() => {
              setOptions([...options, ""]);
              setReview(false);
            }}
          >
            Add option
          </button>
        </fieldset>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            Voting starts (UTC)
            <input
              className={input}
              type="datetime-local"
              required
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
            />
          </label>
          <label>
            Voting ends (UTC)
            <input
              className={input}
              type="datetime-local"
              required
              value={end}
              onInput={(e) => setEnd(e.currentTarget.value)}
            />
          </label>
        </div>
        <p>
          Proposed round: one person, one choice. Eligibility policy, mode and voice credits must be checked against the
          deployment before publication.
        </p>
        <button className={action}>Review draft</button>
        {error && (
          <p role="alert" className="text-amber-200">
            {error}
          </p>
        )}
      </form>
      {review && (
        <section aria-label="Draft review" className="border border-lime-300 rounded-xl p-5 space-y-3">
          <h3 className="text-xl">{question}</h3>
          <p>{context}</p>
          <ol className="list-decimal pl-5">
            {options.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ol>
          <p>
            {start}Z → {end}Z
          </p>
          <Pending>
            Review only. Nothing saved or deployed. Ordered options must be bound to immutable metadata and the deployed
            poll.
          </Pending>
          <Link className="underline text-lime-300" to="/admin/publish">
            Inspect publication requirements (draft is not transferred) →
          </Link>
        </section>
      )}
    </Card>
  );
}
export function RoundScreen({ id }: { id: ScreenId }) {
  const s = screens.find((s) => s.id === id)!;
  return (
    <Shell title={s.title}>
      {id === "login" && (
        <>
          <Card title="One account, two paths">
            <p>Use the same login for participation and administration. Admin access must be granted separately.</p>
            <Unavailable
              label="Log in with Privy"
              reason="Privy is not connected on this branch. This button cannot open a real login yet. The provider and account adapter must be mounted first; see the repository Privy setup guide."
            />
          </Card>
          <div className="flex flex-wrap gap-5 text-lime-300 underline">
            <Link to="/account">Inspect participant screens →</Link>
            <Link to="/admin">Inspect admin screens →</Link>
          </div>
        </>
      )}
      {id === "account" && (
        <>
          <Pending>Not logged in. No participating account, ENS ownership or eligibility has been verified.</Pending>
          <Link className={action} to="/login">
            Log in with Privy
          </Link>
          <Card title="Prepare to participate">
            <ol className="space-y-4 text-lime-300 underline">
              <li>
                <Link to="/account/name">1. Claim an optional ENS name</Link>
              </li>
              <li>
                <Link to="/account/identity">2. Verify eligibility</Link>
              </li>
              <li>
                <Link to="/account/recovery">3. Check voting-key recovery</Link>
              </li>
              <li>
                <Link to="/polls">4. Choose a poll</Link>
              </li>
            </ol>
            <p>Network, participating address, gas sponsorship and logout will appear with the connected session.</p>
          </Card>
        </>
      )}
      {id === "name" && <Link to="/account/name">Open ENS registration →</Link>}
      {id === "identity" && (
        <>
          <Card title="Verification and eligibility">
            <p>
              Self Enterprise is the selected provider. Log in first, then prove control of the participating account
              and open a hosted verification session.
            </p>
            <p>
              The poll’s document support, age/nationality rules and data-handling notice must be available before you
              consent. Provider verification and our eligibility issuer are trusted parts of this round.
            </p>
            <Unavailable
              label="Start identity verification"
              reason="Verification is not connected. No document is requested. The approved policy, hosted-session endpoint and authenticated status reader are required."
            />
          </Card>
          <Card title="Returning from verification">
            <p>
              We must check server status before displaying verified, rejected or expired. Closing the hosted page or
              receiving a redirect does not prove eligibility.
            </p>
            <Link className="text-lime-300 underline" to="/account">
              Return to account →
            </Link>
          </Card>
        </>
      )}
      {id === "keys" && (
        <>
          <Card title="Two different kinds of recovery">
            <p>
              Login recovery restores access to your wallet. MACI uses an independent voting key. A new device or
              cleared browser storage may leave that key unavailable.
            </p>
            <p>
              Do not replace a registered voting key to retry an interrupted vote. Reconnect the original account and
              check the original transaction first.
            </p>
            <Pending>
              Key backup/import and account migration are not connected. This screen never asks you to paste a private
              key.
            </Pending>
          </Card>
          <Link className="text-lime-300 underline" to="/round/receipt">
            Inspect interrupted submission status →
          </Link>
        </>
      )}
      {id === "ballot" && (
        <>
          <Pending>
            No poll selected in this walkthrough. Open a configured poll to inspect its actual question and on-chain
            window.
          </Pending>
          <Link className={action} to="/polls">
            Choose a poll
          </Link>
          <Card title="Before submitting">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Check question, ordered options, policy and closing time.</li>
              <li>Log in; check account and network.</li>
              <li>Confirm eligibility and existing voting-key readiness.</li>
              <li>Review your choice and any fee. Sponsorship denial must not silently charge you.</li>
              <li>Register if needed, join if needed, encrypt and publish.</li>
            </ol>
            <p>
              Submission stays blocked until the selected poll and all required services are ready. The walkthrough does
              not store a ballot choice.
            </p>
          </Card>
          <Link to="/round/receipt" className="text-lime-300 underline">
            Inspect the next screen →
          </Link>
        </>
      )}
      {id === "receipt" && (
        <>
          <Pending>No submission selected. No transaction or counted ballot is claimed.</Pending>
          <Card title="Submission progress">
            <ol className="list-decimal pl-5 space-y-2">
              {[
                "Register with MACI",
                "Join this poll",
                "Prepare proof and encrypt",
                "Publish to the Poll contract",
                "Confirm publication on-chain",
              ].map((x) => (
                <li key={x}>{x} — awaiting a real operation</li>
              ))}
            </ol>
            <p>
              If a transaction was broadcast, check it before retrying. Rejection, pending confirmation, failure,
              wrong-poll transaction and RPC outage need distinct messages.
            </p>
            <p>A confirmed encrypted publication is not an individual proof that your vote was counted.</p>
          </Card>
          <Link className="text-lime-300 underline" to="/round/results">
            Inspect results →
          </Link>
        </>
      )}
      {id === "results" && (
        <>
          <Pending>Verified results unavailable. The result reader is not connected.</Pending>
          <Card title="After voting closes">
            <p>Processing → proof submission → on-chain verification → public result snapshot.</p>
            <p>
              The final view will show option totals, ballot mode, matching poll identity, verification block and
              transaction, provenance and finality. No totals are displayed before those checks.
            </p>
            <p>Demographic breakdowns follow in Stage 2.</p>
          </Card>
          <Link className="text-lime-300 underline" to="/polls">
            Return to polls →
          </Link>
        </>
      )}
      {id === "admin" && (
        <>
          <Pending>
            Admin access has not been checked. This is a public UI walkthrough; administrative actions are not enabled.
          </Pending>
          <Link className={action} to="/login">
            Log in with Privy
          </Link>
          <Card title="Manage the round">
            <div className="flex flex-col gap-4 text-lime-300 underline">
              <Link to="/admin/polls/new">Prepare a draft →</Link>
              <Link to="/admin/publish">Review deployment and naming →</Link>
              <Link to="/admin/coordinator">Coordinate and publish results →</Link>
            </div>
            <p>Owned polls, saved drafts and coordinator jobs will come from authenticated services.</p>
          </Card>
        </>
      )}
      {id === "create" && <Draft />}
      {id === "publish" && (
        <>
          <Pending>No saved draft or deployment selected. Publication is unavailable.</Pending>
          <Card title="Publication checklist">
            <ol className="list-decimal pl-5 space-y-2">
              {[
                "Confirm immutable question, option indexes and metadata digest.",
                "Check Sepolia, MACI address, explicit future UTC dates and capacities.",
                "Confirm enforced eligibility policy, mode and voice credits.",
                "Check coordinator public key, verifying keys and browser proving assets.",
                "Review fee / sponsorship and sign with the authorized operator account.",
                "Wait for the receipt; re-read poll identity, configuration and dates.",
                "Publish checked metadata; optionally register the poll ENS name.",
                "Open the shared name and verify it resolves to this exact poll.",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <p>
              Private coordinator keys stay outside the browser. A failed name publication must not redeploy the poll.
            </p>
          </Card>
          <Link className="text-lime-300 underline" to="/discover">
            Open ENS discovery →
          </Link>
        </>
      )}
      {id === "coordinate" && (
        <>
          <Pending>No authenticated coordinator job service connected.</Pending>
          <Card title="Close → prove → publish">
            <ol className="list-decimal pl-5 space-y-3">
              {[
                "Read the closing time from the chain; wait until voting ends.",
                "Merge the required state.",
                "Process encrypted commands with the private coordinator service.",
                "Generate tally proofs with the matching circuit assets.",
                "Submit and confirm proofs on-chain.",
                "Read verified commitments and publish the matching result snapshot.",
                "Check the public results page and provenance.",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <p>
              Every step needs queued/running/failed/confirmed status, original transaction links and checkpoint
              recovery. Retrying must not duplicate a job or transaction.
            </p>
          </Card>
          <Link className="text-lime-300 underline" to="/round/results">
            Inspect public results →
          </Link>
        </>
      )}
      {id === "help" && (
        <Card title="What this round protects">
          <p>
            Ballot commands are encrypted on-chain. Standard MACI’s coordinator can decrypt commands; the provider and
            our eligibility issuer also carry trust. This is not a guarantee against every form of coercion or metadata
            linkage.
          </p>
          <p>
            ENS names, addresses and public transactions can be linked. Naming is optional and separate from
            eligibility. Login alone does not prove personhood.
          </p>
          <p>
            Never share document payloads or wallet/MACI private keys in chat or support logs. Wallet recovery and
            voting-key recovery are separate.
          </p>
          <p>
            For network errors, retain the original transaction reference and recheck before retrying. No support
            endpoint or approved retention policy is published yet.
          </p>
        </Card>
      )}
      <details className="text-sm text-gray-400 border-t border-gray-800 pt-4">
        <summary className="cursor-pointer">Developer wiring notes · {s.id}</summary>
        <p className="mt-3">{s.wiring}</p>
        <p className="mt-3">Required states/components: {s.components}</p>
      </details>
    </Shell>
  );
}
