import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Globe, Search, ChevronDown } from "lucide-react";
import { isVoteOpen, pollStatusLabel } from "../polls/labels";
import { useConfiguredPoll } from "../polls/useConfiguredPoll";

// --- LANGUAGE CONTENT ---
const content = {
  en: {
    pageTitle: "Poll Explorer",
    brand: "VenekoVox",
    loginStatus: "Verified Anonymous",
    searchPlaceholder: "Search polls by keyword, country, or topic...",
    filters: {
      country: "Country",
      topic: "Topic",
      time: "Time",
      allCountries: "All Countries",
      topics: ["Politics", "Economy", "Culture"],
      times: ["Active", "Archived"],
    },
    pollCard: {
      viewAndVote: "View poll",
      viewResults: "View poll",
      status: "Status",
    },
    sectionTitle: "Configured poll",
    honesty:
      "Question text is operator metadata, not on-chain. Vote totals are hidden until a verified tally exists. The backend health dot only means /health answered.",
    backendUp: "Backend reachable",
    backendDown: "Backend not running",
    noPoll: "No MACI poll is configured in this app environment.",
    scheduleUnknown: "Could not read the voting window from the chain.",
    loading: "Reading the configured poll…",
    footer: {
      privacy: "Privacy Policy",
      about: "About",
      zk: "What is ZK?",
      protection: "How We Protect You",
    },
  },
  es: {
    pageTitle: "Explorador de Encuestas",
    brand: "VenekoVox",
    loginStatus: "Verificado Anónimo",
    searchPlaceholder: "Buscar encuestas por palabra clave, país o tema...",
    filters: {
      country: "País",
      topic: "Tema",
      time: "Fecha",
      allCountries: "Todos los Países",
      topics: ["Política", "Economía", "Cultura"],
      times: ["Activas", "Archivadas"],
    },
    pollCard: {
      viewAndVote: "Ver encuesta",
      viewResults: "Ver encuesta",
      status: "Estado",
    },
    sectionTitle: "Encuesta configurada",
    honesty:
      "El texto de la pregunta es metadato del operador, no está en la cadena. Los totales se ocultan hasta un escrutinio verificado. El punto del backend solo significa que /health respondió.",
    backendUp: "Backend disponible",
    backendDown: "Backend no está en marcha",
    noPoll: "No hay una encuesta MACI configurada en este entorno.",
    scheduleUnknown: "No se pudo leer la ventana de votación en la cadena.",
    loading: "Leyendo la encuesta configurada…",
    footer: {
      privacy: "Política de Privacidad",
      about: "Acerca de",
      zk: "¿Qué es ZK?",
      protection: "Cómo Te Protegemos",
    },
  },
};

// --- MAIN COMPONENT ---
export default function PollExplorer() {
  const [language, setLanguage] = useState("es");
  const currentContent = content[language];
  const configured = useConfiguredPoll();
  const lang = language as "en" | "es";
  const healthOk =
    configured.phase === "ready" || configured.phase === "partial" || configured.phase === "loading"
      ? configured.health?.status === "ok"
      : false;

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold tracking-wider text-white">{currentContent.brand}</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <span className={`relative inline-flex rounded-full h-3 w-3 ${healthOk ? "bg-green-500" : "bg-gray-500"}`} />
              <span className="text-gray-300">{healthOk ? currentContent.backendUp : currentContent.backendDown}</span>
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
        </header>

        <Link to="/discover" className="block mb-6 text-lime-300 underline">
          {language === "en" ? "Find a poll by ENS name →" : "Buscar una encuesta por nombre ENS →"}
        </Link>

        {/* Search & Filters */}
        <div className="mb-10">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={currentContent.searchPlaceholder}
              className="w-full bg-gray-800 border border-gray-700 rounded-full py-3 pl-12 pr-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-4">
              {/* Country Filter - In a real app this would be a dropdown */}
              <button className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-md border border-gray-700 hover:border-blue-500 transition">
                <span>{currentContent.filters.allCountries}</span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {/* Time Filter */}
              <div className="flex items-center bg-gray-800 rounded-md border border-gray-700 p-1">
                <button className="px-3 py-1 text-sm rounded bg-blue-600 text-white">
                  {currentContent.filters.times[0]}
                </button>
                <button className="px-3 py-1 text-sm rounded text-gray-300 hover:bg-gray-700">
                  {currentContent.filters.times[1]}
                </button>
              </div>
            </div>
            <div className="hidden sm:block border-l border-gray-700 h-6 mx-2"></div>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {currentContent.filters.topics.map((topic) => (
                <button
                  key={topic}
                  className="px-3 py-1 text-sm border border-gray-700 rounded-full hover:bg-gray-700 hover:text-white transition"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-6">{currentContent.honesty}</p>

        <h2 className="text-3xl font-bold mb-6 text-white">{currentContent.sectionTitle}</h2>

        {configured.phase === "loading" && <p className="text-gray-300">{currentContent.loading}</p>}
        {configured.phase === "unconfigured" && <p className="text-yellow-300">{currentContent.noPoll}</p>}
        {(configured.phase === "ready" || configured.phase === "partial") && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              to={`/polls/${configured.descriptor.pollId}`}
              className="bg-gray-800/80 border border-gray-700 rounded-lg p-6 flex flex-col justify-between transition-all duration-300 hover:border-blue-500/50 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">Sepolia · Poll {configured.descriptor.pollId}</span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      configured.phase === "ready" && isVoteOpen(configured.schedule.status)
                        ? "bg-green-500/20 text-green-300"
                        : "bg-gray-600/30 text-gray-400"
                    }`}
                  >
                    {configured.phase === "ready"
                      ? pollStatusLabel(configured.schedule.status, lang)
                      : currentContent.scheduleUnknown}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-4">{configured.descriptor.question[lang]}</h3>
              </div>
              <span className="w-full py-2.5 rounded-md font-semibold text-center bg-blue-600 text-white">
                {currentContent.pollCard.viewAndVote}
              </span>
            </Link>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center mt-16 pt-8 border-t border-gray-800">
          <div className="flex justify-center items-center gap-x-6 text-sm text-gray-400">
            <a href="#" className="hover:text-white transition">
              {currentContent.footer.privacy}
            </a>
            <a href="#" className="hover:text-white transition">
              {currentContent.footer.about}
            </a>
            <a href="#" className="hover:text-white transition">
              {currentContent.footer.zk}
            </a>
            <a href="#" className="hover:text-white transition">
              {currentContent.footer.protection}
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
