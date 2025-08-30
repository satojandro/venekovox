import { useState } from 'react';
import { Shield, Globe, CheckCircle, BarChart2, Users, ArrowRight } from 'lucide-react';

// --- MOCK DATA ---
const mockPollDetail = {
  id: 1,
  title: { en: "Do you support dollarization in Venezuela?", es: "¿Apoya la dolarización en Venezuela?" },
  description: {
    en: "This poll seeks to understand public sentiment on transitioning from the Bolívar to the U.S. Dollar as the official currency, a measure proposed to stabilize the economy.",
    es: "Esta encuesta busca entender el sentimiento público sobre la transición del Bolívar al Dólar Estadounidense como moneda oficial, una medida propuesta para estabilizar la economía."
  },
  country: "Venezuela",
  flag: "🇻🇪",
  topic: { en: "Economy", es: "Economía" },
  status: "Open",
  totalVotes: 12589,
  results: { yes: 7890, no: 3450, abstain: 1249 },
  userIsEligible: true,
};

const mockRelatedPolls = [
    { id: 2, title: { en: "Unified opposition candidate for the next election?", es: "¿Candidato de oposición unificado para la próxima elección?" }, country: "Venezuela", flag: "🇻🇪" },
    { id: 7, title: { en: "Should gas subsidies be restructured?", es: "¿Deberían reestructurarse los subsidios a la gasolina?" }, country: "Venezuela", flag: "🇻🇪" },
    { id: 8, title: { en: "Public trust in the national electoral council (CNE).", es: "Confianza pública en el Consejo Nacional Electoral (CNE)." }, country: "Venezuela", flag: "🇻🇪" },
];

// --- LANGUAGE CONTENT ---
const content = {
  en: {
    brand: "VenekoVox",
    loginStatus: "Verified Anonymous",
    verifiedToVote: "You are verified to vote in this poll",
    notEligible: "Only verified Venezuelan citizens may vote. You can still view the results.",
    voteOptions: { yes: "Yes", no: "No", abstain: "Abstain" },
    voteConfirmation: "Your vote has been cast anonymously.",
    updateVote: "Update Vote",
    resultsTitle: "Live Results",
    totalVotes: "Total Votes",
    privacyTitle: "Anonymous & Secure",
    privacyDescription: "Votes are verified via zk-proofs and stored on-chain. Your identity is never revealed.",
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
    notEligible: "Solo los ciudadanos venezolanos verificados pueden votar. Aún puedes ver los resultados.",
    voteOptions: { yes: "Sí", no: "No", abstain: "Abstenerse" },
    voteConfirmation: "Tu voto ha sido emitido de forma anónima.",
    updateVote: "Actualizar Voto",
    resultsTitle: "Resultados en Vivo",
    totalVotes: "Votos Totales",
    privacyTitle: "Anónimo y Seguro",
    privacyDescription: "Los votos se verifican mediante pruebas zk y se almacenan on-chain. Tu identidad nunca se revela.",
    poweredBy: "Impulsado por",
    relatedPollsTitle: "Encuestas Relacionadas en Venezuela",
    tags: "Etiquetas",
    pollContext: "Contexto de la Encuesta",
    status: { open: "Abierta", closed: "Cerrada" },
  },
};

// --- HELPER COMPONENTS ---
const ResultBar = ({ label, percentage, colorClass }) => (
  <div className="w-full">
    <div className="flex justify-between items-center mb-1 text-sm">
      <span className="font-semibold">{label}</span>
      <span className="text-gray-300">{percentage.toFixed(1)}%</span>
    </div>
    <div className="w-full bg-gray-700 rounded-full h-2.5">
      <div
        className={`${colorClass} h-2.5 rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  </div>
);

// --- MAIN COMPONENT ---
export default function PollDetailPage() {
  const [language, setLanguage] = useState('es');
  const [userVote, setUserVote] = useState(null); // null, 'yes', 'no', 'abstain'
  const currentContent = content[language];

  const total = mockPollDetail.results.yes + mockPollDetail.results.no + mockPollDetail.results.abstain;
  const percentages = {
    yes: (mockPollDetail.results.yes / total) * 100,
    no: (mockPollDetail.results.no / total) * 100,
    abstain: (mockPollDetail.results.abstain / total) * 100,
  };

  const handleVote = (vote) => {
    if (mockPollDetail.status === 'Open') {
      setUserVote(vote);
    }
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
      {/* Header */}
      <header className="sticky top-0 bg-gray-900/80 backdrop-blur-md z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-blue-400" />
              <span className="text-2xl font-bold tracking-wider text-white">{currentContent.brand}</span>
            </div>
            <div className="flex items-center space-x-4">
               <button
                onClick={() => setLanguage(l => l === 'en' ? 'es' : 'en')}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors p-2 rounded-md"
                aria-label="Toggle language"
              >
                <Globe className="w-5 h-5" />
                <span className="font-semibold text-sm">{language === 'en' ? 'ES' : 'EN'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 1. Poll Header */}
          <section className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">{mockPollDetail.title[language]}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm mb-4">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${mockPollDetail.status === 'Open' ? 'bg-green-500/20 text-green-300' : 'bg-gray-600/30 text-gray-400'}`}>
                {mockPollDetail.status === 'Open' ? currentContent.status.open : currentContent.status.closed}
              </span>
              <span className="bg-gray-700/50 px-3 py-1 rounded-full">{mockPollDetail.flag} {mockPollDetail.country}</span>
              <span className="bg-gray-700/50 px-3 py-1 rounded-full">{mockPollDetail.topic[language]}</span>
            </div>
            {mockPollDetail.userIsEligible && (
              <div className="flex items-center space-x-2 text-green-400 text-sm mt-3">
                <CheckCircle className="w-5 h-5" />
                <span>{currentContent.verifiedToVote}</span>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <div className="lg:col-span-3">
              {/* 2. Description Box */}
              <section className="mb-8 bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h2 className="text-lg font-bold text-white mb-2">{currentContent.pollContext}</h2>
                <p className="text-gray-300 leading-relaxed">{mockPollDetail.description[language]}</p>
              </section>

              {/* 3. Voting Interface */}
              <section className="mb-8">
                {mockPollDetail.userIsEligible ? (
                  userVote ? (
                    <div className="bg-blue-900/40 border border-blue-500/50 text-center p-6 rounded-lg">
                      <p className="font-semibold text-blue-200 mb-3">{currentContent.voteConfirmation}</p>
                      <p className="text-lg text-white mb-4">
                         {currentContent.voteOptions[userVote]}
                      </p>
                      <button onClick={() => setUserVote(null)} className="text-sm text-blue-300 hover:underline">
                        {currentContent.updateVote}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <button onClick={() => handleVote('yes')} className="w-full py-3 px-4 rounded-lg font-semibold bg-green-600 hover:bg-green-500 transition-transform transform hover:scale-105">{currentContent.voteOptions.yes}</button>
                      <button onClick={() => handleVote('no')} className="w-full py-3 px-4 rounded-lg font-semibold bg-red-600 hover:bg-red-500 transition-transform transform hover:scale-105">{currentContent.voteOptions.no}</button>
                      <button onClick={() => handleVote('abstain')} className="w-full py-3 px-4 rounded-lg font-semibold bg-gray-600 hover:bg-gray-500 transition-transform transform hover:scale-105">{currentContent.voteOptions.abstain}</button>
                    </div>
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
                <h2 className="text-lg font-bold text-white mb-4 flex items-center"><BarChart2 className="w-5 h-5 mr-2"/> {currentContent.resultsTitle}</h2>
                <div className="space-y-4 mb-5">
                  <ResultBar label={currentContent.voteOptions.yes} percentage={percentages.yes} colorClass="bg-green-500" />
                  <ResultBar label={currentContent.voteOptions.no} percentage={percentages.no} colorClass="bg-red-500" />
                  <ResultBar label={currentContent.voteOptions.abstain} percentage={percentages.abstain} colorClass="bg-gray-500" />
                </div>
                <div className="flex justify-between items-center text-sm border-t border-gray-700 pt-3">
                  <span className="text-gray-400">{currentContent.totalVotes}</span>
                  <span className="font-bold text-white">{mockPollDetail.totalVotes.toLocaleString()}</span>
                </div>
              </aside>
            </div>
          </div>

          {/* 5. Privacy + Trust Info */}
          <section className="my-12 bg-gray-800/30 p-6 rounded-lg border border-gray-700/50 flex flex-col sm:flex-row items-center gap-6">
              <Shield className="w-10 h-10 text-blue-400 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-white">{currentContent.privacyTitle}</h3>
                <p className="text-sm text-gray-300 mb-2">{currentContent.privacyDescription}</p>
                <div className="text-xs text-gray-400 flex items-center gap-2">{currentContent.poweredBy}:
                  <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">MACI</span>
                  <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">Semaphore</span>
                  <span className="font-mono bg-gray-700 px-2 py-0.5 rounded">Self.xyz</span>
                </div>
              </div>
          </section>

          {/* 6. Related Polls */}
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">{currentContent.relatedPollsTitle}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockRelatedPolls.map(poll => (
                <a href="#" key={poll.id} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-blue-500 transition group">
                   <p className="font-semibold text-white group-hover:text-blue-300 transition">{poll.title[language]}</p>
                   <div className="flex justify-between items-center mt-3">
                      <span className="text-sm text-gray-400">{poll.flag} {poll.country}</span>
                      <ArrowRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" />
                   </div>
                </a>
              ))}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
