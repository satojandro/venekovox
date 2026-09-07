import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Globe, Search, ChevronDown, Check, X } from "lucide-react";

// --- MOCK DATA ---
const mockPolls = [
  {
    id: 1,
    title: { en: "Do you support dollarization in Venezuela?", es: "¿Apoya la dolarización en Venezuela?" },
    country: "Venezuela",
    flag: "🇻🇪",
    status: "Open",
    totalVotes: 12589,
    topic: { en: "Economy", es: "Economía" },
    userCanVote: true,
  },
  {
    id: 2,
    title: {
      en: "Should there be a unified opposition candidate for the next presidential election?",
      es: "¿Debería haber un candidato de oposición unificado para la próxima elección presidencial?",
    },
    country: "Venezuela",
    flag: "🇻🇪",
    status: "Open",
    totalVotes: 8743,
    topic: { en: "Politics", es: "Política" },
    userCanVote: true,
  },
  {
    id: 3,
    title: {
      en: "What is your confidence level in the current economic recovery plan in Argentina?",
      es: "¿Cuál es su nivel de confianza en el actual plan de recuperación económica en Argentina?",
    },
    country: "Argentina",
    flag: "🇦🇷",
    status: "Open",
    totalVotes: 2310,
    topic: { en: "Economy", es: "Economía" },
    userCanVote: false,
  },
  {
    id: 4,
    title: {
      en: "Public funding for cultural festivals: necessary investment or misuse of funds?",
      es: "Financiamiento público para festivales culturales: ¿inversión necesaria o mal uso de fondos?",
    },
    country: "Colombia",
    flag: "🇨🇴",
    status: "Closed",
    totalVotes: 5420,
    topic: { en: "Culture", es: "Cultura" },
    userCanVote: false,
  },
  {
    id: 5,
    title: {
      en: "Do you agree with the proposed judicial reforms in Mexico?",
      es: "¿Está de acuerdo con las reformas judiciales propuestas en México?",
    },
    country: "Mexico",
    flag: "🇲🇽",
    status: "Open",
    totalVotes: 765,
    topic: { en: "Politics", es: "Política" },
    userCanVote: false,
  },
  {
    id: 6,
    title: {
      en: "Rating the impact of new tech regulations on local startups in Brazil.",
      es: "Evaluando el impacto de las nuevas regulaciones tecnológicas en las startups locales en Brasil.",
    },
    country: "Brazil",
    flag: "🇧🇷",
    status: "Closed",
    totalVotes: 1987,
    topic: { en: "Economy", es: "Economía" },
    userCanVote: false,
  },
];

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
      viewAndVote: "View & Vote",
      viewResults: "View Results",
      totalVotes: "Total Votes",
      status: "Status",
      open: "Open",
      closed: "Closed",
    },
    sectionTitle: "🔥 Trending Polls",
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
      viewAndVote: "Ver y Votar",
      viewResults: "Ver Resultados",
      totalVotes: "Votos Totales",
      status: "Estado",
      open: "Abierta",
      closed: "Cerrada",
    },
    sectionTitle: "🔥 Encuestas Populares",
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
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-gray-300">{currentContent.loginStatus}</span>
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

        {/* Section Header */}
        <h2 className="text-3xl font-bold mb-6 text-white">{currentContent.sectionTitle}</h2>

        {/* Polls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockPolls.map((poll) => (
            <div
              key={poll.id}
              className="bg-gray-800/80 border border-gray-700 rounded-lg p-6 flex flex-col justify-between transition-all duration-300 hover:border-blue-500/50 hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/10"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center text-sm space-x-2">
                    <span>{poll.flag}</span>
                    <span className="text-gray-400">{poll.country}</span>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${poll.status === "Open" ? "bg-green-500/20 text-green-300" : "bg-gray-600/30 text-gray-400"}`}
                  >
                    {poll.status === "Open" ? currentContent.pollCard.open : currentContent.pollCard.closed}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-4 h-16">{poll.title[language]}</h3>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm text-gray-400 mb-5">
                  <span>{currentContent.pollCard.totalVotes}</span>
                  <span className="font-bold text-white">{poll.totalVotes.toLocaleString()}</span>
                </div>
                <button
                  className={`w-full py-2.5 rounded-md font-semibold transition ${poll.userCanVote ? "bg-blue-600 text-white hover:bg-blue-500" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
                >
                  {poll.userCanVote ? currentContent.pollCard.viewAndVote : currentContent.pollCard.viewResults}
                </button>
              </div>
            </div>
          ))}
        </div>

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
