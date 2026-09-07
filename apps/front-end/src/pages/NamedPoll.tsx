import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { JsonRpcProvider, FetchRequest } from "ethers";
import {
  resolvePollName,
  normalizePollName,
  PollNameError,
  type NamedPoll as Result,
  type LookupCode,
} from "../ens/pollName";

const copy = {
  en: {
    title: "A name. A poll. Your voice.",
    intro: "Find a poll by its ENS name on Sepolia.",
    search: "Find poll",
    back: "Poll explorer",
    loading: "Resolving name and checking the poll…",
    refresh: "Check again",
    share: "Share this poll",
    dates: "Voting window (UTC)",
    details: "Poll details",
    note: "ENS names help you find polls. They do not verify a person or grant voting eligibility.",
    boundary:
      "This page shows the resolved poll's on-chain details. Voting and question metadata are not connected here yet.",
    snapshot: "Checked at block",
    mutable: "The name owner can change its records. Check the poll address before participating.",
    status: {
      OPEN: "Voting window open",
      UPCOMING: "Voting starts later",
      CLOSED: "Voting window closed",
      INVALID_WINDOW: "Voting window not configured",
    },
    errors: {
      INVALID_NAME: "Enter a valid .eth name.",
      MISSING_RECORD: "This name has no VenekoVox poll record.",
      INVALID_RECORD: "The poll record is incomplete or invalid.",
      UNSUPPORTED_CHAIN: "This demo supports Sepolia polls only.",
      UNTRUSTED_MACI: "This name points to a MACI deployment this app does not support.",
      POLL_MISMATCH: "The record does not match the poll registered on-chain.",
      LOOKUP_FAILED: "We couldn't verify this name. Check your connection or try again.",
      NOT_CONFIGURED: "ENS discovery needs a Sepolia RPC endpoint and a configured MACI deployment.",
    },
  },
  es: {
    title: "Un nombre. Una encuesta. Tu voz.",
    intro: "Encuentra una encuesta por su nombre ENS en Sepolia.",
    search: "Buscar encuesta",
    back: "Explorar encuestas",
    loading: "Resolviendo el nombre y comprobando la encuesta…",
    refresh: "Verificar de nuevo",
    share: "Compartir encuesta",
    dates: "Período de votación (UTC)",
    details: "Detalles de la encuesta",
    note: "Los nombres ENS ayudan a encontrar encuestas. No verifican a una persona ni otorgan elegibilidad para votar.",
    boundary:
      "Esta página muestra los datos on-chain de la encuesta. La votación y el texto de la pregunta aún no están conectados aquí.",
    snapshot: "Verificado en el bloque",
    mutable: "El propietario del nombre puede cambiar sus registros. Comprueba la dirección antes de participar.",
    status: {
      OPEN: "Período de votación abierto",
      UPCOMING: "La votación comienza después",
      CLOSED: "Período de votación cerrado",
      INVALID_WINDOW: "Período de votación sin configurar",
    },
    errors: {
      INVALID_NAME: "Introduce un nombre .eth válido.",
      MISSING_RECORD: "Este nombre no tiene un registro de encuesta VenekoVox.",
      INVALID_RECORD: "El registro de encuesta está incompleto o no es válido.",
      UNSUPPORTED_CHAIN: "Esta demo solo admite encuestas en Sepolia.",
      UNTRUSTED_MACI: "El nombre apunta a un despliegue MACI que esta aplicación no admite.",
      POLL_MISMATCH: "El registro no coincide con la encuesta on-chain.",
      LOOKUP_FAILED: "No pudimos verificar el nombre. Comprueba la conexión e inténtalo de nuevo.",
      NOT_CONFIGURED: "Configura un RPC de Sepolia y el despliegue MACI para usar ENS.",
    },
  },
};
type State = { phase: "idle" | "loading" } | { phase: "error"; code: LookupCode } | { phase: "ready"; result: Result };
function date(seconds: string) {
  const n = Number(seconds);
  if (!Number.isSafeInteger(n) || n > 8640000000000) return seconds + " (Unix)";
  return new Date(n * 1000).toISOString();
}
export default function NamedPoll() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(name ?? ""),
    [language, setLanguage] = useState<"en" | "es">("en");
  const [state, setState] = useState<State>({ phase: "idle" }),
    [attempt, setAttempt] = useState(0);
  const t = copy[language];
  const operation = useRef(0);
  useEffect(() => {
    setInput(name ?? "");
    if (!name) {
      setState({ phase: "idle" });
      return;
    }
    let current = true;
    const revision = ++operation.current;
    const rpc = import.meta.env.VITE_ENS_RPC_URL as string | undefined;
    const maci = import.meta.env.VITE_MACI_ADDRESS as string | undefined;
    if (!rpc || !maci) {
      setState({ phase: "error", code: "NOT_CONFIGURED" });
      return;
    }
    let provider: JsonRpcProvider;
    try {
      if (!["http:", "https:"].includes(new URL(rpc).protocol)) throw new Error();
      // No wallet connection/signature is requested by discovery.
      const request = new FetchRequest(rpc);
      request.timeout = 15000;
      provider = new JsonRpcProvider(request);
    } catch {
      setState({ phase: "error", code: "NOT_CONFIGURED" });
      return;
    }
    setState({ phase: "loading" });
    resolvePollName(name, provider, [maci]).then(
      (result) => {
        if (current && operation.current === revision) setState({ phase: "ready", result });
      },
      (error) => {
        if (current && operation.current === revision)
          setState({ phase: "error", code: error instanceof PollNameError ? error.code : "LOOKUP_FAILED" });
      },
    );
    return () => {
      current = false;
      provider.destroy();
    };
  }, [name, attempt]);
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex justify-between">
          <Link to="/polls" className="text-lime-300">
            ← {t.back}
          </Link>
          <button onClick={() => setLanguage(language === "en" ? "es" : "en")}>
            {language === "en" ? "ES" : "EN"}
          </button>
        </header>
        <div>
          <p className="text-lime-300 tracking-widest">VENEKOVOX / ENSv2 / SEPOLIA</p>
          <h1 className="text-4xl font-bold my-4">{t.title}</h1>
          <p className="text-gray-300">{t.intro}</p>
        </div>
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            operation.current++;
            try {
              const normalized = normalizePollName(input);
              navigate("/p/" + encodeURIComponent(normalized));
              setAttempt((x) => x + 1);
            } catch {
              setState({ phase: "error", code: "INVALID_NAME" });
            }
          }}
        >
          <label className="sr-only" htmlFor="poll-name">
            ENS name
          </label>
          <input
            id="poll-name"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="your-poll.eth"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={255}
            className="flex-1 min-w-0 bg-gray-900 border border-gray-600 rounded-lg p-3"
          />
          <button className="bg-lime-300 text-black px-5 rounded-lg" type="submit">
            {t.search}
          </button>
        </form>
        <div aria-live="polite">
          {state.phase === "loading" && <p>{t.loading}</p>}
          {state.phase === "error" && <p role="alert">{t.errors[state.code]}</p>}
        </div>
        {state.phase === "ready" && (
          <section className="border border-lime-400 rounded-xl p-6 space-y-4" aria-label={t.details}>
            <h2 className="text-2xl font-bold break-all">{state.result.name}</h2>
            <p className="text-lime-300">{t.status[state.result.status]}</p>
            <dl className="space-y-3">
              <dt>Poll ID</dt>
              <dd>{state.result.reference.pollId}</dd>
              <dt>Poll / Sepolia</dt>
              <dd className="break-all">
                <a
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                  href={"https://sepolia.etherscan.io/address/" + state.result.reference.poll}
                >
                  {state.result.reference.poll}
                </a>
              </dd>
              <dt>MACI</dt>
              <dd className="break-all">{state.result.reference.maci}</dd>
              <dt>{t.dates}</dt>
              <dd>
                {date(state.result.startTime)} → {date(state.result.endTime)}
              </dd>
            </dl>
            <p>
              {t.snapshot} {state.result.blockNumber}
            </p>
            <Link className="underline text-lime-300" to={"/p/" + encodeURIComponent(state.result.name)}>
              {t.share}: /p/{state.result.name}
            </Link>
            <p className="text-gray-400">{t.mutable}</p>
            <p className="text-gray-300">{t.boundary}</p>
          </section>
        )}
        {name && (
          <button onClick={() => setAttempt((x) => x + 1)} className="underline">
            {t.refresh}
          </button>
        )}
        <p className="text-sm text-gray-400">{t.note}</p>
      </div>
    </main>
  );
}
