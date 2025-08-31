import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SelfQRcodeWrapper, SelfAppBuilder, type SelfApp } from '@selfxyz/qrcode';
import { getUniversalLink } from '@selfxyz/core';
import { ethers } from 'ethers';
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

// --- MAIN COMPONENT ---
export default function TrustRitualPage() {
  const [language, setLanguage] = useState<'en' | 'es'>('es');
  const [status, setStatus] = useState<'unverified' | 'verifying' | 'verified'>('unverified');
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState('');
  const navigate = useNavigate();
  const currentContent = content[language];

  useEffect(() => {
    // Initialize Self app configuration
    const initSelfApp = async () => {
      try {
        const userId = ethers.ZeroAddress; // Use zero address for demo

        const app = new SelfAppBuilder({
          version: 2,
          appName: "VenekoVox",
          scope: process.env.VITE_SELF_SCOPE || "venekovox-trust-ritual",
          endpoint: process.env.VITE_SELF_ENDPOINT || "https://api.self.xyz",
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png", // Default Self logo
          userId: userId,
          endpointType: "staging_https",
          userIdType: "hex",
          userDefinedData: "VenekoVox Trust Ritual",
          disclosures: {
            // Verification requirements
            minimumAge: 18,
            ofac: false,
            excludedCountries: [],

            // Disclosure requests (what we want to know anonymously)
            nationality: true,
            gender: true,
            // date_of_birth: false, // We don't need DOB, just age verification
          }
        }).build();

        setSelfApp(app);
        setUniversalLink(getUniversalLink(app));
      } catch (error) {
        console.error('Failed to initialize Self app:', error);
      }
    };

    initSelfApp();
  }, []);

  const handleVerification = () => {
    setStatus('verifying');
  };

  const handleVerificationSuccess = async () => {
    try {
      // For now, simulate successful verification
      // In production, the SelfQRcodeWrapper would handle the backend communication
      // and the verification data would be processed automatically

      // Store verification flag
      localStorage.setItem('venekovox_verified', 'true');

      // TODO: In production, implement proper backend integration
      // The SelfQRcodeWrapper handles the verification flow internally
      // and calls onSuccess when complete

      setStatus('verified');
    } catch (error) {
      console.error('Error storing verification data:', error);
      setStatus('unverified');
    }
  };

  const handleVerificationError = (error: { error_code?: string, reason?: string }) => {
    console.error('Verification failed:', error);
    setStatus('unverified');
  };

  const handleExplorePolls = () => {
    navigate('/polls');
  };

  const openSelfApp = () => {
    if (universalLink) {
      window.open(universalLink, '_blank');
    }
  };

  const hashData = async (data: string) => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans flex flex-col">
      {/* Header */}
      <header className="w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-blue-500/10 p-8 text-center">

            {status === 'unverified' && (
              <>
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-3">{currentContent.pageTitle}</h1>
                <div className="text-gray-300 space-y-2 mb-8">
                    <p>"{currentContent.intro.line1}"</p>
                    <p className="font-semibold text-white">"{currentContent.intro.line2}"</p>
                    <p>"{currentContent.intro.line3}"</p>
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
                {selfApp ? (
                  <>
                    <SelfQRcodeWrapper
                      selfApp={selfApp}
                      onSuccess={handleVerificationSuccess}
                      onError={handleVerificationError}
                    />
                    <p className="text-lg text-gray-300 mt-4">{currentContent.status.verifying}</p>
                    <p className="text-sm text-gray-400 mt-2">Scan with Self app or use the button below</p>
                    <button
                      onClick={openSelfApp}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition duration-300"
                    >
                      Open Self App
                    </button>
                  </>
                ) : (
                  <>
                    <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
                    <p className="text-lg text-gray-300">Loading verification...</p>
                  </>
                )}
              </div>
            )}

            {status === 'verified' && (
              <div className="flex flex-col items-center justify-center h-80">
                <CheckCircle className="w-20 h-20 text-green-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">{currentContent.status.verifiedTitle}</h2>
                <p className="text-gray-300 mb-8">{currentContent.status.verifiedMessage}</p>
                <button
                  onClick={handleExplorePolls}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 flex items-center justify-center space-x-2"
                >
                  <span>{currentContent.status.explorePolls}</span>
                  <ArrowRight className="w-5 h-5"/>
                </button>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
