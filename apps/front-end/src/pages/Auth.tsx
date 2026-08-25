import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Globe, CheckCircle, ArrowRight, Loader2, ScanLine } from "lucide-react";
import { SelfQRcodeWrapper, SelfAppBuilder } from "@selfxyz/qrcode";
import type { SelfApp } from "@selfxyz/qrcode";

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
      step1: "Scan the QR code with the Self app on your phone.",
      step2: "Your data never touches our servers. Only a cryptographic proof is shared.",
    },
    cta: "Verify with Self",
    scanPrompt: "Scan with the Self mobile app",
    status: {
      verifying: "Verifying your credentials...",
      verifiedTitle: "Verification Successful",
      verifiedMessage: "You're now eligible to vote anonymously.",
      explorePolls: "Explore Polls",
    },
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
      step1: "Escanea el código QR con la app de Self en tu teléfono.",
      step2: "Tus datos nunca tocan nuestros servidores. Solo se comparte una prueba criptográfica.",
    },
    cta: "Verificar con Self",
    scanPrompt: "Escanéalo con la app móvil de Self",
    status: {
      verifying: "Verificando tus credenciales...",
      verifiedTitle: "Verificación Exitosa",
      verifiedMessage: "Ahora estás elegido para votar de forma anónima.",
      explorePolls: "Explorar Encuestas",
    },
  },
};

export default function TrustRitualPage() {
  const [language, setLanguage] = useState<"en" | "es">("es");
  const [status, setStatus] = useState<"unverified" | "verifying" | "verified" | "error">("unverified");
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();
  const currentContent = content[language];

  useEffect(() => {
    // Build the SelfApp config once on mount.
    // userId: stable per browser session so nullifiers can't be correlated across polls.
    const initSelfApp = () => {
      try {
        let userId = localStorage.getItem("venekovox_user_id");
        if (!userId) {
          userId = crypto.randomUUID();
          localStorage.setItem("venekovox_user_id", userId);
        }

        const app = new SelfAppBuilder({
          version: 2,
          appName: "VenekoVox",
          scope: import.meta.env.VITE_SELF_SCOPE || "venekovox-trust-ritual",
          endpoint: import.meta.env.VITE_SELF_ENDPOINT || "http://localhost:3100/verify",
          userId,
          userIdType: "uuid",
          userDefinedData: "VenekoVox Trust Ritual",
          disclosures: {
            minimumAge: 18,
            ofac: false,
            excludedCountries: [],
            nationality: true,
            gender: true,
            // date_of_birth stays hidden — we only need age proof
          },
        }).build();

        setSelfApp(app);
      } catch (err) {
        console.error("Failed to initialize Self app:", err);
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to initialize verification");
      }
    };
    initSelfApp();
  }, []);

  const handleVerificationSuccess = () => {
    localStorage.setItem("venekovox_verified", "true");
    setStatus("verified");
  };

  const handleVerificationError = (err: { error_code?: string; reason?: string }) => {
    console.error("Verification failed:", err);
    setErrorMsg(err.reason || err.error_code || "Verification failed");
  };

  const handleExplorePolls = () => navigate("/polls");

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

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl shadow-blue-500/10 p-8 text-center">
            {status === "unverified" && selfApp && (
              <>
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-3">{currentContent.pageTitle}</h1>
                <div className="text-gray-300 space-y-2 mb-6">
                  <p>"{currentContent.intro.line1}"</p>
                  <p className="font-semibold text-white">"{currentContent.intro.line2}"</p>
                  <p>"{currentContent.intro.line3}"</p>
                </div>

                {/* Live Self.xyz QR code — scan with the Self mobile app */}
                <div className="bg-white rounded-xl p-4 inline-block mb-4">
                  <SelfQRcodeWrapper
                    selfApp={selfApp}
                    onSuccess={handleVerificationSuccess}
                    onError={handleVerificationError}
                    darkMode={false}
                    size={280}
                  />
                </div>
                <p className="text-sm text-gray-400 mb-6 flex items-center justify-center gap-2">
                  <ScanLine className="w-4 h-4" /> {currentContent.scanPrompt}
                </p>
              </>
            )}

            {status === "unverified" && !selfApp && (
              <>
                <Shield className="w-16 h-16 text-blue-400 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-3">{currentContent.pageTitle}</h1>
                <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                <p className="text-gray-400 mt-4">{currentContent.status.verifying}</p>
                {status === "unverified" && errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
              </>
            )}

            {status === "verifying" && (
              <>
                <Loader2 className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-6" />
                <h1 className="text-2xl font-bold text-white mb-3">{currentContent.status.verifying}</h1>
              </>
            )}

            {status === "verified" && (
              <>
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">{currentContent.status.verifiedTitle}</h2>
                <p className="text-gray-300 mb-8">{currentContent.status.verifiedMessage}</p>
                <button
                  onClick={handleExplorePolls}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300 transform hover:scale-105"
                >
                  <span>{currentContent.status.explorePolls}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
