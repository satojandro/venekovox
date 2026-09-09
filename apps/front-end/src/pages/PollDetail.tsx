import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Shield, Globe, BarChart2 } from "lucide-react";
import { useMaci } from "../hooks/useMaci";
import { isVoteOpen, pollStatusLabel } from "../polls/labels";
import { useConfiguredPoll } from "../polls/useConfiguredPoll";

// --- LANGUAGE CONTENT ---
const content = {
  en: {
    brand: "VenekoVox",
    loginStatus: "Verified Anonymous",
    verifiedToVote: "You are verified to vote in this poll",
    notEligible: "Eligibility is not enforced in this UI. The voting window below comes from the Poll contract.",
    unknownPoll: "This URL is not the poll configured in the app.",
    resultsUnavailable: "Verified results are not published yet. Encrypted message counts are not vote totals.",
    windowClosed: "This poll is not open for voting on the configured chain.",
    metadataNote: "Question text is operator metadata, not stored on the Poll contract.",
    voteOptions: { yes: "Yes", no: "No", abstain: "Abstain" },
    voteConfirmation: "Your encrypted vote has been submitted. Results will be available after the verified tally.",
    submissionRecorded: "Your encrypted vote was recorded. Awaiting on-chain confirmation…",
    submissionPending: "Submission found on chain — awaiting confirmation.",
    submissionFailed: "Your submission failed on-chain. You can try again.",
    submissionUnknown: "Could not verify your submission on-chain.",
    submissionUnexpected: "This transaction is not a vote publication for this poll.",
    checkAgain: "Check again",
    retryVote: "You can choose an option below to try again.",
    wrongChain: "Your wallet is connected to the wrong network. Switch to Sepolia to participate.",
    keyMissing:
      "No voting key found on this device. Vote to create one, or restore your key to recover your participation.",
    keyInvalid: "The saved voting key is invalid. Restore your key before continuing.",
    lookupFailed: "The chain did not answer. Check your connection and refresh.",
    keyStorageError:
      "This browser blocked access to the saved voting key. Check site storage permissions and try again.",
    resultsTitle: "Verified results",
    totalVotes: "Total Votes",
    privacyTitle: "Anonymous & Secure",
    privacyDescription:
      "Ballot commands are encrypted on-chain. The MACI coordinator can decrypt commands; public account metadata may remain linkable.",
    poweredBy: "Powered by",
    relatedPollsTitle: "Related Polls in Venezuela",
    tags: "Tags",
    pollContext: "Poll Context",
    status: { open: "Open", closed: "Closed" },
  },
  es: {
    brand: "VenekoVox",
    loginStatus: "Verificado Anónimo",
    verifiedToVote: "Estás verificado para votar en esta encuesta",
    notEligible: "Esta pantalla no aplica elegibilidad. La ventana de votación sale del contrato Poll.",
    unknownPoll: "Esta URL no es la encuesta configurada en la aplicación.",
    resultsUnavailable: "Aún no hay resultados verificados. El recuento de mensajes cifrados no es un total de votos.",
    windowClosed: "Esta encuesta no está abierta para votar en la cadena configurada.",
    metadataNote: "El texto de la pregunta es metadato del operador; no está en el contrato Poll.",
    voteOptions: { yes: "Sí", no: "No", abstain: "Abstenerse" },
    voteConfirmation:
      "Tu voto cifrado ha sido enviado. Los resultados estarán disponibles después del escrutinio verificado.",
    submissionRecorded: "Tu voto cifrado fue registrado. Esperando confirmación on-chain…",
    submissionPending: "Envío encontrado en la cadena — esperando confirmación.",
    submissionFailed: "Tu envío falló en la cadena. Puedes intentarlo de nuevo.",
    submissionUnknown: "No se pudo verificar tu envío en la cadena.",
    submissionUnexpected: "Esta transacción no es una publicación de voto para esta encuesta.",
    checkAgain: "Verificar de nuevo",
    retryVote: "Puedes elegir una opción abajo para intentarlo de nuevo.",
    wrongChain: "Tu wallet está conectada a la red incorrecta. Cambia a Sepolia para participar.",
    keyMissing:
      "No se encontró una clave de votación en este dispositivo. Vota para crear una, o restaura tu clave para recuperar tu participación.",
    keyInvalid: "La clave de votación guardada no es válida. Restaura tu clave para continuar.",
    lookupFailed: "La cadena no respondió. Revisa tu conexión y actualiza.",
    keyStorageError:
      "Este navegador bloqueó el acceso a la clave de votación guardada. Revisa los permisos de almacenamiento e inténtalo de nuevo.",
    resultsTitle: "Resultados verificados",
    totalVotes: "Votos Totales",
    privacyTitle: "Anónimo y Seguro",
    privacyDescription:
      "Los comandos de voto se cifran on-chain. El coordinador MACI puede descifrarlos; los metadatos públicos de la cuenta pueden vincularse.",
    poweredBy: "Impulsado por",
    relatedPollsTitle: "Encuestas Relacionadas en Venezuela",
    tags: "Etiquetas",
    pollContext: "Contexto de la Encuesta",
    status: { open: "Abierta", closed: "Cerrada" },
  },
};

// --- MAIN COMPONENT ---
export default function PollDetailPage() {
  const { id } = useParams();
  const [language, setLanguage] = useState("es");
  const [userVote, setUserVote] = useState<string | null>(null); // null, 'yes', 'no', 'abstain'
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const maci = useMaci();
  const configured = useConfiguredPoll();
  const lang = language as "en" | "es";
  const currentContent = content[language];
  const descriptor =
    configured.phase === "ready" || configured.phase === "partial" || configured.phase === "loading"
      ? configured.descriptor
      : null;
  const schedule = configured.phase === "ready" ? configured.schedule : null;
  const isConfiguredPoll = !!descriptor && id === descriptor.pollId;
  const windowOpen = isVoteOpen(schedule?.status);

  // A receipt only counts as "submission confirmed" for the wallet that owns it,
  // AND only when the chain verified it. A stored hash alone is never
  // confirmation: the copy depends on receiptStatus (G02), and "counted" is the
  // tally's claim (P4), never this UI's.
  const ownedReceipt = maci.receipt && maci.account && maci.receiptAccount === maci.account ? maci.receipt : null;
  const receiptState = ownedReceipt ? (maci.receiptStatus ?? "unverified") : null;
  const confirmedReceipt = ownedReceipt && receiptState === "confirmed" ? ownedReceipt : null;
  // Only a reverted submission may be retried. Anything else with a live receipt
  // locks the buttons so we never double-submit while the outcome is unknown.
  const votesLocked = !windowOpen || (!!ownedReceipt && receiptState !== "reverted");

  const receiptBanner =
    receiptState === "reverted"
      ? { title: currentContent.submissionFailed, box: "bg-red-900/40 border-red-500/50", text: "text-red-200" }
      : receiptState === "unexpected"
        ? {
            title: currentContent.submissionUnexpected,
            box: "bg-yellow-900/30 border-yellow-500/40",
            text: "text-yellow-200",
          }
        : receiptState === "unavailable"
          ? { title: currentContent.submissionUnknown, box: "bg-gray-800/60 border-gray-600/50", text: "text-gray-300" }
          : receiptState === "pending"
            ? {
                title: currentContent.submissionPending,
                box: "bg-blue-900/40 border-blue-500/50",
                text: "text-blue-200",
              }
            : receiptState === "unverified"
              ? {
                  title: currentContent.submissionRecorded,
                  box: "bg-blue-900/40 border-blue-500/50",
                  text: "text-blue-200",
                }
              : null;

  const participationNotice =
    maci.participation.status === "wrong-chain"
      ? currentContent.wrongChain
      : maci.participation.status === "key-missing"
        ? currentContent.keyMissing
        : maci.participation.status === "key-invalid"
          ? currentContent.keyInvalid
          : maci.participation.status === "lookup-failed"
            ? currentContent.lookupFailed
            : maci.participation.status === "key-storage-error"
              ? currentContent.keyStorageError
              : null;

  // vote options mapped to MACI vote option indices
  const VOTE_OPTIONS: Record<string, number> = { yes: 0, no: 1, abstain: 2 };

  // Re-read the chain window at click time. A tab opened before the poll
  // opens (or left open after it closes) must not use the first paint.
  const handleVote = async (vote: string) => {
    if (submitting.current || (!!ownedReceipt && receiptState !== "reverted")) return;
    submitting.current = true;
    setError(null);
    try {
      const latest = await configured.refresh();
      if (!latest) {
        setError(currentContent.lookupFailed);
        return;
      }
      if (!isVoteOpen(latest.status)) {
        setError(currentContent.windowClosed);
        return;
      }
      const result = await maci.vote(VOTE_OPTIONS[vote]);
      // Display the confirmation only if the wallet that completed the submission
      // is still the live one. A mid-flight switch (A -> B) must never render A's
      // submission under B; the hook files the receipt under A's context regardless.
      if (maci.account && result.account.toLowerCase() === maci.account.toLowerCase()) {
        setUserVote(vote);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      submitting.current = false;
    }
  };

  // A wallet/account change invalidates local submission display; the hook
  // re-hydrates participation and any receipt belonging to the new context.
  useEffect(() => {
    setUserVote(null);
  }, [maci.account]);

  return (
    <div className="bg-black text-gray-200 min-h-screen font-sans">
      {/* Header */}
      <header className="sticky top-0 bg-gray-900/80 backdrop-blur-md z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-lime-300" />
              <span className="text-2xl font-bold tracking-wider text-white">{currentContent.brand}</span>
            </div>
            <div className="flex items-center space-x-4">
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
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <p className="mb-4">
            <Link to="/polls" className="text-lime-300 underline">
              ← {lang === "en" ? "All polls" : "Todas las encuestas"}
            </Link>
          </p>
          {!isConfiguredPoll && configured.phase !== "loading" && (
            <p className="mb-6 text-yellow-300">{currentContent.unknownPoll}</p>
          )}
          <nav aria-label="Round navigation" className="flex flex-wrap gap-5 mb-6 text-lime-300 underline">
            <Link to="/">Home</Link>
            <Link to="/account">Account / eligibility</Link>
            <Link to="/round/ballot">Voting prerequisites</Link>
            <Link to="/round/results">Results readiness</Link>
          </nav>
          {/* 1. Poll Header */}
          <section className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              {descriptor ? descriptor.question[lang] : currentContent.unknownPoll}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  windowOpen ? "bg-green-500/20 text-green-300" : "bg-gray-600/30 text-gray-400"
                }`}
              >
                {schedule ? pollStatusLabel(schedule.status, lang) : currentContent.status.closed}
              </span>
              <span className="bg-gray-700/50 px-3 py-1 rounded-full">Sepolia</span>
              {descriptor && (
                <span className="bg-gray-700/50 px-3 py-1 rounded-full font-mono">Poll {descriptor.pollId}</span>
              )}
            </div>
            <p className="text-sm text-gray-400">{currentContent.metadataNote}</p>
            {!windowOpen && <p className="text-sm text-yellow-300 mt-3">{currentContent.windowClosed}</p>}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              {/* 2. Description Box */}
              <section className="mb-8 bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h2 className="text-lg font-bold text-white mb-2">{currentContent.pollContext}</h2>
                <p className="text-gray-300 leading-relaxed">
                  {descriptor ? descriptor.description[lang] : currentContent.unknownPoll}
                </p>
                {schedule && (
                  <p className="text-xs text-gray-500 mt-3 font-mono break-all">
                    Poll {schedule.pollAddress} · start {schedule.startTime} · end {schedule.endTime} · block{" "}
                    {schedule.blockNumber}
                  </p>
                )}
              </section>

              {/* 3. Voting Interface */}
              <section className="mb-8">
                {isConfiguredPoll ? (
                  receiptState === "confirmed" ? (
                    <div className="bg-blue-900/40 border border-blue-500/50 text-center p-6 rounded-lg">
                      <p className="font-semibold text-blue-200 mb-3">{currentContent.voteConfirmation}</p>
                      {userVote && <p className="text-lg text-white mb-4">{currentContent.voteOptions[userVote]}</p>}
                      <p className="text-xs text-blue-200 break-all">Tx: {ownedReceipt!.txHash}</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 text-center text-sm text-gray-300">
                        {maci.account ? (
                          <span>
                            Wallet:{" "}
                            <span className="text-blue-300 font-mono">
                              {maci.account.slice(0, 6)}…{maci.account.slice(-4)}
                            </span>
                            {maci.status === "joining" && (
                              <span className="ml-2 text-yellow-300">Joining poll (zk-proof in browser)…</span>
                            )}
                            {maci.status === "signing-up" && (
                              <span className="ml-2 text-yellow-300">Signing up to MACI…</span>
                            )}
                            {maci.status === "voting" && (
                              <span className="ml-2 text-yellow-300">Publishing encrypted vote…</span>
                            )}
                          </span>
                        ) : (
                          <button
                            disabled={maci.isBusy}
                            onClick={() => maci.connect().catch((e) => setError(e.message))}
                            className="bg-lime-300 text-black hover:bg-lime-200 font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            Connect Wallet
                          </button>
                        )}
                      </div>
                      {participationNotice && (
                        <div className="mb-3 text-center text-sm text-yellow-300">{participationNotice}</div>
                      )}
                      {receiptBanner && ownedReceipt && (
                        <div className={`border text-center p-4 rounded-lg mb-4 ${receiptBanner.box}`}>
                          <p className={`font-semibold mb-2 ${receiptBanner.text}`}>{receiptBanner.title}</p>
                          {receiptState === "reverted" && (
                            <p className={`text-sm mb-2 ${receiptBanner.text}`}>{currentContent.retryVote}</p>
                          )}
                          <p className="text-xs text-gray-300 break-all">Tx: {ownedReceipt.txHash}</p>
                          {maci.canRecheck && (
                            <button
                              type="button"
                              disabled={maci.isBusy}
                              onClick={() => maci.recheckReceipt()}
                              className="mt-3 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {currentContent.checkAgain}
                            </button>
                          )}
                        </div>
                      )}
                      {error && (
                        <div className="mb-3 bg-red-900/40 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm">
                          {error}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <button
                          disabled={votesLocked || maci.isBusy}
                          onClick={() => handleVote("yes")}
                          className="w-full py-3 px-4 rounded-lg font-semibold bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-transform transform hover:scale-105"
                        >
                          {currentContent.voteOptions.yes}
                        </button>
                        <button
                          disabled={votesLocked || maci.isBusy}
                          onClick={() => handleVote("no")}
                          className="w-full py-3 px-4 rounded-lg font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-transform transform hover:scale-105"
                        >
                          {currentContent.voteOptions.no}
                        </button>
                        <button
                          disabled={votesLocked || maci.isBusy}
                          onClick={() => handleVote("abstain")}
                          className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-transform transform hover:scale-105"
                        >
                          {currentContent.voteOptions.abstain}
                        </button>
                      </div>
                    </>
                  )
                ) : (
                  <div className="bg-yellow-900/30 border border-yellow-500/40 text-center p-4 rounded-lg text-yellow-200 text-sm">
                    {currentContent.notEligible}
                  </div>
                )}
              </section>
            </div>

            <div className="lg:col-span-2">
              {/* 4. Live Results Visuals */}
              <aside className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 sticky top-24">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                  <BarChart2 className="w-5 h-5 mr-2" /> {currentContent.resultsTitle}
                </h2>
                <p className="text-sm text-gray-300 leading-relaxed">{currentContent.resultsUnavailable}</p>
              </aside>
            </div>
          </div>

          {/* 5. Privacy + Trust Info */}
          <section className="my-12 bg-gray-800/30 p-6 rounded-lg border border-gray-700/50 flex flex-col sm:flex-row items-center gap-6">
            <Shield className="w-10 h-10 text-lime-300 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-white">{currentContent.privacyTitle}</h3>
              <p className="text-sm text-gray-300 mb-2">{currentContent.privacyDescription}</p>
              <div className="text-xs text-gray-400 flex items-center gap-2">
                {currentContent.poweredBy}:<span className="font-mono bg-gray-700 px-2 py-0.5 rounded">MACI</span>
                <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">Semaphore</span>
                <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">Self.xyz</span>
              </div>
            </div>
          </section>

          <p className="text-sm text-gray-400">{currentContent.notEligible}</p>
        </div>
      </main>
    </div>
  );
}
