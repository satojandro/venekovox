import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Globe, CheckCircle, ArrowRight, Loader2, ScanLine } from "lucide-react";
import QRCode from "qrcode";
import { eligibilityApi } from "../eligibility/api";
import { startZkPassportRequest } from "../eligibility/request";
import { saveEligibility, type EligibilityRecord } from "../eligibility/storage";

type FlowStatus = "unverified" | "qr" | "relayed" | "authorized" | "error";

const content = {
  en: {
    brand: "VenekoVox",
    pageTitle: "The Trust Ritual",
    intro: {
      line1: "Trust begins with transparency—and courage.",
      line2: "We don't need to know who you are, only that you are.",
      line3: "Verified but anonymous. Seen, but safe.",
    },
    connect: "Connect wallet",
    begin: "Begin eligibility",
    scanPrompt: "Scan with the ZKPassport app",
    relayed: "Proofs relayed — server is verifying…",
    authorizedTitle: "Eligibility granted",
    authorizedMessage: "Gate evidence is stored for join. This is not a vote.",
    explorePolls: "Explore Polls",
    retry: "Try again",
  },
  es: {
    brand: "VenekoVox",
    pageTitle: "El Ritual de Confianza",
    intro: {
      line1: "La confianza comienza con transparencia—y coraje.",
      line2: "No necesitamos saber quién eres, solo que eres.",
      line3: "Verificado pero anónimo. Visto, pero seguro.",
    },
    connect: "Conectar billetera",
    begin: "Comenzar elegibilidad",
    scanPrompt: "Escanea con la app ZKPassport",
    relayed: "Pruebas reenviadas — el servidor está verificando…",
    authorizedTitle: "Elegibilidad concedida",
    authorizedMessage: "La evidencia de acceso está guardada para unirte. Esto no es un voto.",
    explorePolls: "Explorar Encuestas",
    retry: "Intentar de nuevo",
  },
};

export default function TrustRitualPage() {
  const [language, setLanguage] = useState<"en" | "es">("es");
  const [status, setStatus] = useState<FlowStatus>("unverified");
  const [account, setAccount] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrHref, setQrHref] = useState<string | null>(null);
  const [record, setRecord] = useState<EligibilityRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const copy = content[language];

  const fail = (message: string) => {
    setErrorMsg(message);
    setStatus("error");
    setBusy(false);
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) throw new Error("No injected wallet (MetaMask) found");
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
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans flex flex-col">
      <header className="w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold tracking-wider text-white">{copy.brand}</span>
            </div>
            <button
              onClick={() => setLanguage((l) => (l === "en" ? "es" : "en"))}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors p-2 rounded-md"
              aria-label="Toggle language"
            >
              <Globe className="w-5 h-5" />
              <span className="font-semibold text-sm">{language === "en" ? "ES" : "EN"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-blue-500/10 p-8 text-center">
            {status === "unverified" && (
              <>
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-3">{copy.pageTitle}</h1>
                <div className="text-gray-300 space-y-2 mb-6">
                  <p>"{copy.intro.line1}"</p>
                  <p className="font-semibold text-white">"{copy.intro.line2}"</p>
                  <p>"{copy.intro.line3}"</p>
                </div>
                {!account ? (
                  <button
                    onClick={connectWallet}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    {copy.connect}
                  </button>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-4 font-mono break-all">{account}</p>
                    <button
                      onClick={begin}
                      disabled={busy}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-5 h-5 animate-spin inline" /> : copy.begin}
                    </button>
                  </>
                )}
              </>
            )}

            {status === "qr" && qrUrl && (
              <>
                <h1 className="text-2xl font-bold text-white mb-3">{copy.pageTitle}</h1>
                <div className="bg-white rounded-xl p-4 inline-block mb-4">
                  <img src={qrUrl} alt="ZKPassport QR" width={280} height={280} />
                </div>
                <p className="text-sm text-gray-400 mb-4 flex items-center justify-center gap-2">
                  <ScanLine className="w-4 h-4" /> {copy.scanPrompt}
                </p>
                {qrHref && (
                  <p className="text-xs text-gray-500 break-all">
                    <a href={qrHref} className="underline">
                      {qrHref}
                    </a>
                  </p>
                )}
              </>
            )}

            {status === "relayed" && (
              <>
                <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-6" />
                <h1 className="text-xl font-bold text-white">{copy.relayed}</h1>
              </>
            )}

            {status === "authorized" && record && (
              <>
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">{copy.authorizedTitle}</h2>
                <p className="text-gray-300 mb-4">{copy.authorizedMessage}</p>
                <p className="text-xs text-gray-500 font-mono break-all mb-6">{record.evidence.slice(0, 42)}…</p>
                <button
                  onClick={() => navigate("/polls")}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg"
                >
                  <span>{copy.explorePolls}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}

            {status === "error" && (
              <>
                <h1 className="text-2xl font-bold text-white mb-3">{copy.pageTitle}</h1>
                <p className="text-red-400 text-sm mb-6 break-words">{errorMsg}</p>
                <button
                  onClick={() => {
                    setStatus("unverified");
                    setErrorMsg("");
                    setQrUrl(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg"
                >
                  {copy.retry}
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
