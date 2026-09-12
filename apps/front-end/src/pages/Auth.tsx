import { useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Loader2, ScanLine } from "lucide-react";
import { FieldNote, JourneySteps } from "../components/Experience";
import { eligibilityApi } from "../eligibility/api";
import { startZkPassportRequest } from "../eligibility/request";
import { saveEligibility, type EligibilityRecord } from "../eligibility/storage";
import { useConfiguredPoll } from "../polls/useConfiguredPoll";

type FlowStatus = "unverified" | "qr" | "relayed" | "authorized" | "error";

export default function TrustRitualPage() {
  const [status, setStatus] = useState<FlowStatus>("unverified");
  const [account, setAccount] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrHref, setQrHref] = useState<string | null>(null);
  const [record, setRecord] = useState<EligibilityRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const poll = useConfiguredPoll();
  const descriptor = poll.phase !== "unconfigured" ? poll.descriptor : null;

  const fail = (message: string) => {
    setErrorMsg(message);
    setStatus("error");
    setBusy(false);
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        throw new Error("Open this page in a browser with a wallet extension, such as Rainbow or MetaMask.");
      }
      const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
      setAccount(accounts[0]);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Wallet connect failed");
    }
  };

  const begin = async () => {
    if (!account || !window.ethereum) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const challenge = await eligibilityApi.challenge(account);
      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [challenge.message, account],
      })) as string;
      const params = await eligibilityApi.begin(challenge.challengeId, signature);
      const started = await startZkPassportRequest(
        params,
        async (payload) => {
          try {
            setStatus("relayed");
            const receivePayload = {
              proofs: payload.proofs,
              originalQuery: payload.originalQuery ?? params.query,
              queryResult: payload.queryResult,
            };
            const received = await eligibilityApi.receive(challenge.challengeId, signature, receivePayload);
            if (received.outcome !== "accepted" && received.outcome !== "duplicate") {
              throw new Error(received.outcome);
            }
            const grant = await eligibilityApi.authorize(challenge.challengeId, signature);
            const next: EligibilityRecord = {
              venue: "zkpassport",
              account: grant.authorization.account,
              evidence: grant.evidence,
              signature: grant.signature,
              issuedAt: grant.authorization.issuedAt,
              expiresAt: grant.authorization.expiresAt,
            };
            saveEligibility(next);
            setRecord(next);
            setStatus("authorized");
          } catch (error) {
            fail(error instanceof Error ? error.message : "Server verification failed");
          }
        },
        (message) => fail(message),
      );
      setQrHref(started.url);
      setQrUrl(await QRCode.toDataURL(started.url, { width: 320, margin: 2 }));
      setStatus("qr");
      setBusy(false);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Begin failed");
    }
  };

  return (
    <main className="section-wrap journey-page narrow">
      <JourneySteps active={1} />
      <p className="eyebrow">02 / ELIGIBILITY, WITHOUT A PUBLIC DOCUMENT</p>
      <h1>Prove you belong. Keep more to yourself.</h1>
      <p>
        Your phone creates the proof. Our server verifies it and issues a short-lived permission for this
        poll.
      </p>
      <div className="banner">
        {descriptor?.eligibilityLabel || "Check this poll’s requirements before verifying."}
        <span className="quiet-note">
          {" "}
          Nationality comes from the document, not from your IP address or where you live. Age 18+.
          People outside the selected countries can explore the site but cannot vote.
        </span>
      </div>

      <section className="panel" style={{ textAlign: "center", marginTop: 20 }}>
        {status === "unverified" && (
          <>
            <p>Use the same wallet you used for naming, if you claimed a name.</p>
            {!account ? (
              <button className="action-primary" type="button" onClick={connectWallet}>
                Connect wallet
              </button>
            ) : (
              <>
                <p className="mono">{account}</p>
                <button className="action-primary" type="button" onClick={begin} disabled={busy}>
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Begin eligibility"}
                </button>
              </>
            )}
          </>
        )}

        {status === "qr" && qrUrl && (
          <>
            <h2>Scan with the ZKPassport app</h2>
            <div className="qr-frame">
              <img src={qrUrl} alt="ZKPassport QR code" width={280} height={280} />
            </div>
            <p className="quiet-note">
              <ScanLine size={16} /> Keep this tab open while your phone finishes.
            </p>
            {qrHref && (
              <p className="mono">
                <a href={qrHref}>{qrHref}</a>
              </p>
            )}
          </>
        )}

        {status === "relayed" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin" />
            <h2>Proofs relayed — server is verifying…</h2>
            <p>UI success waits for server authorization, not for the phone’s progress bar alone.</p>
          </>
        )}

        {status === "authorized" && record && (
          <>
            <h2>Eligibility granted</h2>
            <p>Your authorization is ready. Join the poll shortly: this permission expires.</p>
            <p className="quiet-note">Expires {new Date(record.expiresAt * 1000).toLocaleTimeString()}</p>
            <button
              className="action-primary"
              type="button"
              onClick={() => navigate(descriptor ? `/polls/${descriptor.pollId}` : "/polls")}
            >
              Continue to your ballot
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="banner danger">{errorMsg}</div>
            <button
              className="action-secondary"
              type="button"
              onClick={() => {
                setStatus("unverified");
                setErrorMsg("");
                setQrUrl(null);
              }}
            >
              Try again
            </button>
          </>
        )}
      </section>

      <FieldNote title="What still requires trust?">
        <p>
          The eligibility issuer checks access. Document support depends on ZKPassport and the issuing
          country. The join transaction is public, even though your choice is encrypted. This is not a
          promise that nothing ever reaches a server.
        </p>
      </FieldNote>
      <FieldNote title="Why a phone and a wallet?">
        <p>
          ZKPassport checks your supported document and FaceMatch on your phone. Your wallet signs a
          message to show you control the account receiving permission. Your wallet is not your passport.
        </p>
      </FieldNote>
    </main>
  );
}
