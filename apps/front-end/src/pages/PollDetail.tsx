import { EditorialArt } from "../components/EditorialArt";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FieldNote, JourneySteps } from "../components/Experience";
import { useNamedAccount } from "../ens/useNamedAccount";
import { themeClassName } from "../ens/profile";
import { copyText, sepoliaTxUrl } from "../lib/clipboard";
import { fetchJoinedParticipants } from "../lib/inclusionProof";
import { useMaci } from "../hooks/useMaci";
import { assertBallotIndex, canSubmitBallot } from "../polls/ballot";
import { isVoteOpen, pollStatusLabel } from "../polls/labels";
import { useConfiguredPoll } from "../polls/useConfiguredPoll";

export default function PollDetailPage() {
  const { id } = useParams();
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joined, setJoined] = useState<{
    joinedParticipants: string;
    indexedBlock: number;
    indexedBlockHash: string;
    hasIndexingError: boolean;
  } | null>(null);
  const submitting = useRef(false);
  const maci = useMaci();
  const named = useNamedAccount(maci.account);
  const configured = useConfiguredPoll();
  const descriptor =
    configured.phase === "ready" || configured.phase === "partial" || configured.phase === "loading"
      ? configured.descriptor
      : null;
  const schedule = configured.phase === "ready" ? configured.schedule : null;
  const isConfiguredPoll = !!descriptor && id === descriptor.pollId;
  const windowOpen = isVoteOpen(schedule?.status);

  useEffect(() => {
    const pollAddress = schedule?.pollAddress;
    if (!pollAddress) return;
    const backendUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined) || "http://localhost:3100";
    void fetchJoinedParticipants({ backendUrl, pollAddress }).then(setJoined);
  }, [schedule?.pollAddress]);

  const ownedReceipt = maci.receipt && maci.account && maci.receiptAccount === maci.account ? maci.receipt : null;
  const receiptState = ownedReceipt ? (maci.receiptStatus ?? "unverified") : null;
  const votesLocked = !windowOpen || (!!ownedReceipt && receiptState !== "reverted");

  useEffect(() => {
    setSelected(null);
  }, [maci.account]);

  const handleVote = async () => {
    if (!descriptor || submitting.current || (!!ownedReceipt && receiptState !== "reverted")) return;
    if (!canSubmitBallot({ options: descriptor.options, selected, locked: votesLocked, busy: maci.isBusy })) return;
    submitting.current = true;
    setError(null);
    try {
      const latest = await configured.refresh();
      if (!latest) {
        setError("The chain did not answer. Check your connection and refresh.");
        return;
      }
      if (!isVoteOpen(latest.status)) {
        setError("This poll is not open for voting on the configured chain.");
        return;
      }
      const index = assertBallotIndex(descriptor, selected as number);
      await maci.vote(index);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      submitting.current = false;
    }
  };

  const copyHash = async () => {
    if (!ownedReceipt) return;
    const ok = await copyText(ownedReceipt.txHash);
    setCopied(ok);
  };

  const statusText = schedule
    ? pollStatusLabel(schedule.status, "en")
    : configured.phase === "partial"
      ? "Schedule unavailable"
      : configured.phase === "loading"
        ? "Checking availability"
        : "Not configured";

  const progress =
    maci.status === "signing-up"
      ? "Signing up to MACI…"
      : maci.status === "joining"
        ? "Joining the poll (this can take a minute)…"
        : maci.status === "voting"
          ? "Publishing the encrypted ballot…"
          : maci.status === "connecting"
            ? "Connecting wallet…"
            : null;

  const participationNotice =
    maci.participation.status === "wrong-chain"
      ? "Your wallet is connected to the wrong network. Switch to Sepolia to participate."
      : maci.participation.status === "key-missing"
        ? "No voting key found on this device. Vote to create one, or restore your key to recover your participation."
        : maci.participation.status === "key-invalid"
          ? "The saved voting key is invalid. Restore your key before continuing."
          : maci.participation.status === "lookup-failed"
            ? "The chain did not answer. Check your connection and refresh."
            : maci.participation.status === "key-storage-error"
              ? "This browser blocked access to the saved voting key."
              : null;

  const receiptCopy =
    receiptState === "confirmed"
      ? "Encrypted ballot submitted"
      : receiptState === "pending"
        ? "Submission found on chain — awaiting confirmation."
        : receiptState === "unverified"
          ? "Your encrypted vote was recorded. Awaiting on-chain confirmation…"
          : receiptState === "reverted"
            ? "Your submission failed on-chain. You can try again."
            : receiptState === "unexpected"
              ? "This transaction is not a vote publication for this poll."
              : receiptState === "unavailable"
                ? "Could not verify your submission on-chain."
                : null;

  return (
    <main className="section-wrap journey-page">
      <JourneySteps active={2} />
      <p>
        <Link className="text-link" to="/polls">
          ← All polls
        </Link>
      </p>
      {!isConfiguredPoll && configured.phase !== "loading" && (
        <div className="banner warn">This URL is not the poll configured in the app.</div>
      )}
      <header className="journey-cover">
        <div className="journey-cover-copy">
          <p className="eyebrow">03 / {descriptor?.topic || "YOUR BALLOT"}</p>
          <h1>{descriptor ? descriptor.question.en : "This poll is not configured."}</h1>
          <p>Your own opinion. An encrypted ballot.</p>
        </div>
        <EditorialArt scene="ballot" />
      </header>
      <div className="status-row">
        <span className="chip">{statusText}</span>
        {descriptor && <span className="chip">Poll {descriptor.pollId}</span>}
        <span className="chip">Sepolia</span>
      </div>
      <p>{descriptor?.description.en}</p>
      {descriptor?.preset === "superintelligence-v1" && (
        <FieldNote title="Read the context">
          <p>
            Sanders and Casar announced forthcoming US legislation on 3 September 2026 that would mix a permanent
            development ban with a temporary advanced-AI pause. This poll asks only about a global development ban. It
            is not an endorsement of that bill, and it does not treat a pause as the same as a ban.
          </p>
          <p>
            <a href="https://www.sanders.senate.gov/press-releases/news-sanders-casar-introduce-legislation-to-ban-artificial-superintelligence-and-temporarily-pause-advanced-ai-development/">
              Sanders/Casar announcement
            </a>
            {" · "}
            <a href="https://lordslibrary.parliament.uk/superintelligent-ai-should-its-development-be-stopped/">
              Background on definitions
            </a>
            {" · "}
            <a href="https://employment-social-affairs.ec.europa.eu/policies-and-activities/moving-working-europe/eu-social-security-coordination/frequently-asked-questions/faq-social-security-where-do-these-rules-apply_en">
              EU membership
            </a>
          </p>
        </FieldNote>
      )}

      <div className="explorer-grid" style={{ marginTop: 28 }}>
        <section className="panel">
          {!maci.account ? (
            <button
              className="action-primary"
              type="button"
              disabled={maci.isBusy}
              onClick={() => maci.connect().catch((e) => setError(e.message))}
            >
              Connect wallet
            </button>
          ) : (
            <p>
              Wallet{" "}
              {named.setup?.phase === "ready" ? (
                <strong className={themeClassName(named.setup.theme)}>{named.setup.name}</strong>
              ) : (
                <span className="mono">
                  {maci.account.slice(0, 6)}…{maci.account.slice(-4)}
                </span>
              )}
              {" · "}
              <Link to="/names">Names</Link>
              {" · "}
              <Link to="/trust-ritual">Eligibility</Link>
            </p>
          )}
          {progress && <p className="quiet-note">{progress}</p>}
          {participationNotice && <div className="banner warn">{participationNotice}</div>}
          {error && <div className="banner danger">{error}</div>}

          {isConfiguredPoll && receiptState === "confirmed" && ownedReceipt && (
            <div className="banner ok">
              <h2>Encrypted ballot submitted</h2>
              <p>A receipt is not a counted result. The selected choice is not stored in this receipt.</p>
              <p className="mono">{ownedReceipt.txHash}</p>
              <p>
                <a href={sepoliaTxUrl(ownedReceipt.txHash)}>View on Sepolia explorer</a>
                {" · "}
                <button className="text-link" type="button" onClick={() => void copyHash()}>
                  {copied ? "Copied" : "Copy transaction hash"}
                </button>
              </p>
            </div>
          )}

          {isConfiguredPoll && receiptBanner(receiptState, receiptCopy, ownedReceipt, maci, copyHash, copied)}

          {isConfiguredPoll && receiptState !== "confirmed" && (
            <>
              <FieldNote title="What your wallet will ask">
                <p>
                  One click runs signup if needed, join if needed, then publish. Those are separate on-chain steps
                  inside one flow. A pending or unknown send cannot be duplicated from this page.
                </p>
              </FieldNote>
              <div className="option-group" role="radiogroup" aria-label="Ballot options">
                {descriptor!.options.map((option) => (
                  <button
                    key={option.index}
                    type="button"
                    role="radio"
                    aria-checked={selected === option.index}
                    className="option-row"
                    disabled={votesLocked || maci.isBusy}
                    onClick={() => setSelected(option.index)}
                  >
                    <span className="mark" />
                    {option.label.en}
                  </button>
                ))}
              </div>
              <button
                className="action-primary"
                type="button"
                disabled={
                  !canSubmitBallot({
                    options: descriptor!.options,
                    selected,
                    locked: votesLocked,
                    busy: maci.isBusy,
                  })
                }
                onClick={() => void handleVote()}
              >
                Submit encrypted ballot
              </button>
              {!windowOpen && <p className="quiet-note">This poll is not open for voting on the configured chain.</p>}
            </>
          )}
          {!isConfiguredPoll && configured.phase !== "loading" && (
            <div className="banner warn">The ballot is only shown for the poll configured in this app.</div>
          )}
        </section>

        <aside className="panel results-panel">
          <p className="eyebrow">THE RECORD / AFTER THE VOTE</p>
          <EditorialArt scene="records" />
          <h2>Verified results</h2>
          <p>
            Verified results are not published yet. Encrypted message counts and joined-participant counts are not vote
            totals.
          </p>
          {schedule && (
            <p className="mono">
              Poll {schedule.pollAddress}
              <br />
              Tally {schedule.tallyAddress}
              <br />
              Block {schedule.blockNumber}
            </p>
          )}
          {joined && joined.joinedParticipants !== "unavailable" && (
            <p className="quiet-note">
              Joined participants (indexed): {joined.joinedParticipants} at block {joined.indexedBlock}. This is not
              turnout and not a result.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}

function receiptBanner(
  receiptState: string | null,
  title: string | null,
  ownedReceipt: { txHash: string } | null,
  maci: ReturnType<typeof useMaci>,
  copyHash: () => void,
  copied: boolean,
) {
  if (!ownedReceipt || receiptState === "confirmed" || !title) return null;
  return (
    <div className={`banner ${receiptState === "reverted" ? "danger" : "warn"}`}>
      <p>{title}</p>
      <p className="mono">{ownedReceipt.txHash}</p>
      <p>
        <a href={sepoliaTxUrl(ownedReceipt.txHash)}>View on Sepolia explorer</a>
        {" · "}
        <button className="text-link" type="button" onClick={() => void copyHash()}>
          {copied ? "Copied" : "Copy transaction hash"}
        </button>
      </p>
      {maci.canRecheck && (
        <button className="action-secondary" type="button" disabled={maci.isBusy} onClick={() => maci.recheckReceipt()}>
          Check again
        </button>
      )}
    </div>
  );
}
