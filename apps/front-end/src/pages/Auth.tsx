import { useState } from 'react';
import { Shield, Globe, CheckCircle, ArrowRight, Loader2, ScanLine } from 'lucide-react';

// --- LANGUAGE CONTENT ---
const content = {
  en: {
    brand: "VenekoVox",
    pageTitle: "The Trust Ritual",
    intro: {
      line1: "Trust begins with transparency—and courage.",
      line2: "We don't need to know who you are, only that you are.",
      line3: "Verified but anonymous. Seen, but safe.",
    },
    howItWorks: {
      title: "How Verification Works",
      step1: "Scan your passport using the Self app.",
      step2: "Your data never touches our servers. Only a cryptographic proof is shared.",
    },
    cta: "Verify with Self",
    status: {
      verifying: "Verifying your credentials...",
      verifiedTitle: "Verification Successful",
      verifiedMessage: "You're now eligible to vote anonymously.",
      explorePolls: "Explore Polls",
    }
  },
  es: {
    brand: "VenekoVox",
    pageTitle: "El Ritual de Confianza",
    intro: {
      line1: "La confianza comienza con transparencia—y coraje.",
      line2: "No necesitamos saber quién eres, solo que eres.",
      line3: "Verificado pero anónimo. Visto, pero seguro.",
    },
    howItWorks: {
      title: "Cómo Funciona la Verificación",
      step1: "Escanea tu pasaporte usando la app de Self.",
      step2: "Tus datos nunca tocan nuestros servidores. Solo se comparte una prueba criptográfica.",
    },
    cta: "Verificar con Self",
    status: {
      verifying: "Verificando tus credenciales...",
      verifiedTitle: "Verificación Exitosa",
      verifiedMessage: "Ahora eres elegible para votar de forma anónima.",
      explorePolls: "Explorar Encuestas",
    }
  },
};

export default function TrustRitualPage() {
  const [language, setLanguage] = useState<'en' | 'es'>('es');
  const [status, setStatus] = useState<'unverified' | 'verifying' | 'verified'>('unverified');
  const currentContent = content[language];

  const handleVerification = async () => {
    try {
      setStatus('verifying');

      const response = await fetch('http://localhost:3001/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: 'mock-proof',
          publicSignals: ['mock-signal']
        })
      });

      const result = await response.json();

      if (result.status === 'verified') {
        localStorage.setItem('venekovox_verified', 'true');
        setStatus('verified');
      } else {
        throw new Error('Verification failed');
      }
    } catch (err) {
      console.error('Verification error:', err);
      alert('Verification failed. Please try again.');
      setStatus('unverified');
    }
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans flex flex-col">
      <header className="w-full">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold tracking-wider text-white">{currentContent.brand}</span>
          </div>
          <button
            onClick={() => setLanguage(l => l === 'en' ? 'es' : 'en')}
            className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors p-2 rounded-md"
            aria-label="Toggle language"
          >
            <Globe className="w-5 h-5" />
            <span className="font-semibold text-sm">{language === 'en' ? 'ES' : 'EN'}</span>
          </button>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-blue-500/10 p-8 text-center">
            {status === 'unverified' && (
              <>
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-3">{currentContent.pageTitle}</h1>
                <div className="text-gray-300 space-y-2 mb-8">
                  <p>{currentContent.intro.line1}</p>
                  <p className="font-semibold text-white">{currentContent.intro.line2}</p>
                  <p>{currentContent.intro.line3}</p>
                </div>
                <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 text-left text-sm mb-8 space-y-3">
                  <h2 className="font-semibold text-white text-center mb-3">{currentContent.howItWorks.title}</h2>
                  <div className="flex items-start space-x-3">
                    <ScanLine className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>{currentContent.howItWorks.step1}</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span>{currentContent.howItWorks.step2}</span>
                  </div>
                </div>
                <button
                  onClick={handleVerification}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105"
                >
                  {currentContent.cta}
                </button>
              </>
            )}

            {status === 'verifying' && (
              <div className="flex flex-col items-center justify-center h-80">
                <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                <p className="text-lg text-gray-300">{currentContent.status.verifying}</p>
              </div>
            )}

            {status === 'verified' && (
              <div className="flex flex-col items-center justify-center h-80">
                <CheckCircle className="w-20 h-20 text-green-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">{currentContent.status.verifiedTitle}</h2>
                <p className="text-gray-300 mb-8">{currentContent.status.verifiedMessage}</p>
                <a href="/polls" className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center space-x-2">
                  <span>{currentContent.status.explorePolls}</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
