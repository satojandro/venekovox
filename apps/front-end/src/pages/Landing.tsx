import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  UserCheck,
  Lock,
  ChevronDown,
  Globe,
  ArrowRight,
  EyeOff,
  Flame,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

const content = {
  en: {
    nav: {
      mission: "The Problem",
      howItWorks: "How It Works",
      polls: "Explore Polls",
      underTheHood: "Architecture & Trust",
    },
    hero: {
      badge: "Zero Bot Manipulation · Absolute Ballot Secrecy",
      headline: "The Truth Layer for Civic Sentiment.",
      subheadline:
        "Break the silent majority. Express your true conviction on the issues that shape our world—completely free, verified human, and protected forever against retaliation, social cancellation, or state blacklists.",
      ctaExplore: "Browse Active Polls",
      ctaLearn: "See How Your Privacy Is Protected",
    },
    threats: {
      tag: "THE CRISIS OF CIVIC VOICE",
      title: "Why Public Opinion Is Broken Today",
      subtitle:
        "Whether under state repression or social polarization, honest voices are forced into silence while artificial noise dominates.",
      card1: {
        tag: "Authoritarian Intimidation",
        title: "State Retaliation & Rigged Numbers",
        desc: "Where dissent carries personal risk—loss of jobs, social aid, or physical safety—citizens have no way to demonstrate real collective opposition. Official results are fabricated, leaving populations feeling isolated and powerless.",
        quote: "Real sentiment drops below 10%, yet people have no safe way to prove it.",
      },
      card2: {
        tag: "Social Polarization",
        title: "The Silent Majority & Cancel Culture",
        desc: "In modern open democracies, peer pressure and the fear of career ruin muzzle millions. People self-censor their real views, allowing vocal extremes and bot farms to manufacture false consensus.",
        quote: "Fear of social ostracization turns the majority into a silent observer.",
      },
      card3: {
        tag: "Synthetic Reality",
        title: "AI Swarms & Broken Polling",
        desc: "Traditional phone polls fail across every election cycle. Social media feeds are flooded with AI personas and paid astroturfing. Nobody knows what their neighbors actually believe anymore.",
        quote: "Manufactured narratives replace ground-truth civic sentiment.",
      },
    },
    howItWorks: {
      tag: "SIMPLE & SECURE",
      title: "How It Works for You",
      subtitle: "No crypto wallets to manage. No fees. Just honest participation with ironclad privacy.",
      step1: {
        step: "01",
        title: "Choose Your Pseudonym",
        desc: "Pick a community name to represent yourself. Your real name, device data, and private life are never linked to your public actions.",
      },
      step2: {
        step: "02",
        title: "Prove You're a Real Human",
        desc: "Scan your passport or national ID once. None of your personal details or biometric data are ever stored or sent to any server—the system only checks that you are a unique, eligible citizen.",
      },
      step3: {
        step: "03",
        title: "Vote Your True Conviction",
        desc: "Your ballot is encrypted so thoroughly that even if a coercer, employer, or family member demands to see your screen, it is mathematically impossible to prove to them how you voted.",
      },
      step4: {
        step: "04",
        title: "See Verified Public Results",
        desc: "When polls close, results are published openly for journalists, researchers, and citizens to inspect. The total count is mathematically guaranteed, while your vote remains permanently secret.",
      },
    },
    guarantees: {
      tag: "CONSUMER GUARANTEES",
      title: "Designed for Real People",
      items: [
        {
          title: "100% Free Forever",
          desc: "You never need to buy tokens, hold crypto, or pay network fees to voice your opinion.",
        },
        {
          title: "Un-bribable & Coercion-Free",
          desc: "You cannot prove your vote to anyone, which means nobody can pay you or threaten you to vote a certain way.",
        },
        {
          title: "Zero Bot Farm Infiltration",
          desc: "Every voice corresponds to a verified living person. No AI bots, no duplicate accounts, no astroturfing.",
        },
        {
          title: "Independent Public Audit",
          desc: "Results aren't calculated in a back room. Anyone in the world can cryptographically verify the total tally.",
        },
      ],
    },
    underTheHood: {
      tag: "FOR DEVELOPERS, RESEARCHERS & AUDITORS",
      title: "Under the Hood: Open Source Cryptography",
      subtitle: "VenekoVox doesn't ask for your trust; it enforces it with peer-reviewed zero-knowledge math.",
      zkIdentityTitle: "Zero-Knowledge Eligibility (Self Protocol)",
      zkIdentityDesc:
        "Proves attributes (e.g. Venezuelan citizenship, age of majority) by generating zero-knowledge proofs directly inside your browser. The verifier smart contract receives mathematical proof that you qualify without ever seeing your name, document number, or face.",
      maciTitle: "Anti-Collusion Ballot Encryption (MACI)",
      maciDesc:
        "Developed by Ethereum's Privacy & Scaling Explorations (PSE), Minimum Anti-Collusion Infrastructure (MACI) encrypts every vote command using coordinator public keys. Voters can change their registered voting keys at any time, neutralizing vote-buying and coercive intimidation.",
      graphTitle: "Standardized Public Indexing (The Graph & Messari)",
      graphDesc:
        "All poll schemas, non-identifying participation metrics, and ZK-verified tally proofs are indexed using open Messari-compatible governance standards, making results accessible to researchers worldwide.",
      ensTitle: "Decentralized Poll Discovery (ENSv2)",
      ensDesc:
        "Polls are addressed by human-readable civic spaces like venezuela2026.eth using the official Universal Resolver on Sepolia, removing technical barriers to civic discovery.",
    },
    footer: {
      rights: "VenekoVox — The Truth Layer for Civic Sentiment.",
      about: "Documentation",
      github: "GitHub Repository",
      journey: "Technical Journey Map",
    },
  },
  es: {
    nav: {
      mission: "El Problema",
      howItWorks: "Cómo Funciona",
      polls: "Explorar Encuestas",
      underTheHood: "Arquitectura y Confianza",
    },
    hero: {
      badge: "Cero Manipulación por Bots · Secreto Electoral Absoluto",
      headline: "La Capa de Verdad para el Sentimiento Cívico.",
      subheadline:
        "Rompe la mayoría silenciosa. Expresa tu verdadera convicción sobre los temas de interés público—completamente gratis, con identidad humana verificada y protección permanente contra represalias, cancelación social o listas negras estatales.",
      ctaExplore: "Ver Encuestas Activas",
      ctaLearn: "Cómo Protegemos tu Privacidad",
    },
    threats: {
      tag: "LA CRISIS DE LA VOZ CIUDADANA",
      title: "Por Qué la Opinión Pública Está Rota",
      subtitle:
        "Tanto bajo represión estatal como bajo polarización social, las voces honestas se ven forzadas al silencio mientras el ruido artificial domina.",
      card1: {
        tag: "Intimidación Estatal",
        title: "Represalia del Estado y Cifras Manipuladas",
        desc: "Cuando disentir conlleva peligro real—pérdida de empleo, beneficios sociales o seguridad física—la ciudadanía no tiene cómo demostrar su oposición colectiva. Las cifras oficiales se manipulan, dejando a la gente aislada e indefensa.",
        quote: "El respaldo real cae por debajo del 10%, pero nadie tiene un canal seguro para evidenciarlo.",
      },
      card2: {
        tag: "Polarización Social",
        title: "La Mayoría Silenciosa y la Cancelación",
        desc: "En democracias abiertas, la presión social y el temor a la ruina profesional amordazan a millones. La gente autocensura sus opiniones reales, permitiendo que minorías ruidosas fabriquen falsos consensos.",
        quote: "El miedo al ostracismo social convierte a la mayoría en espectadora silenciosa.",
      },
      card3: {
        tag: "Realidad Artificial",
        title: "Granjas de Bots y Encuestas Fallidas",
        desc: "Las encuestas tradicionales fallan elección tras elección. Las redes sociales están inundadas de cuentas falsas e inteligencia artificial. Nadie sabe con certeza qué piensan realmente sus vecinos.",
        quote: "Las narrativas fabricadas reemplazan el sentir cívico genuino.",
      },
    },
    howItWorks: {
      tag: "FÁCIL Y SEGURO",
      title: "Cómo Funciona para Ti",
      subtitle: "Sin billeteras cripto complicadas. Sin comisiones. Participación honesta con privacidad inviolable.",
      step1: {
        step: "01",
        title: "Elige tu Seudónimo",
        desc: "Escoge un nombre público para identificarte en la comunidad. Tu nombre real, datos de dispositivo o vida privada jamás se vinculan a tu actividad.",
      },
      step2: {
        step: "02",
        title: "Demuestra que Eres Humano",
        desc: "Verifícate una sola vez con tu pasaporte o documento nacional. Ningún dato personal o biométrico se guarda ni se envía a servidores: el sistema solo valida que eres una persona real y única de tu país.",
      },
      step3: {
        step: "03",
        title: "Vota con Verdadera Convicción",
        desc: "Tu voto se cifra de tal manera que incluso si un superior, familiar o extorsionador te exige ver tu pantalla, es matemáticamente imposible demostrarle qué opción marcaste.",
      },
      step4: {
        step: "04",
        title: "Consulta Resultados Verificados",
        desc: "Al cerrar la votación, los resultados consolidados se publican para el mundo, la prensa y la investigación cívica. El conteo total está garantizado por matemáticas mientras tu voto permanece secreto.",
      },
    },
    guarantees: {
      tag: "GARANTÍAS PARA EL CIUDADANO",
      title: "Diseñado para Personas Reales",
      items: [
        {
          title: "100% Gratis Siempre",
          desc: "Nunca necesitas comprar criptomonedas ni pagar tarifas de red para hacer oír tu voz.",
        },
        {
          title: "Inmune a Sobornos y Coacción",
          desc: "Al no poder demostrar tu voto, nadie puede pagarte ni amenazarte para forzar tu decisión.",
        },
        {
          title: "Cero Infiltración de Bots",
          desc: "Cada voto corresponde a una persona de carne y hueso comprobada. Cero cuentas sintéticas.",
        },
        {
          title: "Auditoría Pública Independiente",
          desc: "El escrutinio no ocurre a puertas cerradas; cualquiera en el mundo puede verificar el conteo.",
        },
      ],
    },
    underTheHood: {
      tag: "PARA DESARROLLADORES, INVESTIGADORES Y AUDITORES",
      title: "Bajo el Capó: Criptografía de Código Abierto",
      subtitle: "VenekoVox no te pide un acto de fe; garantiza tu seguridad mediante matemáticas de conocimiento cero.",
      zkIdentityTitle: "Elegibilidad de Conocimiento Cero (Self Protocol)",
      zkIdentityDesc:
        "Demuestra requisitos (nacionalidad, mayoría de edad) generando pruebas en tu navegador. El contrato inteligente valida matemáticamente que calificas sin ver jamás tu nombre, documento o rostro.",
      maciTitle: "Cifrado Anti-Coerción de Votos (MACI)",
      maciDesc:
        "Desarrollado por Privacy & Scaling Explorations (PSE) de Ethereum. Cifra cada voto con claves del coordinador y permite anular votos forzados mediante re-asignación de llaves.",
      graphTitle: "Indexación Pública Estandarizada (The Graph y Messari)",
      graphDesc:
        "Los esquemas de votación, la participación y las pruebas de escrutinio se indexan con estándares abiertos compatibles con Messari para auditoría global.",
      ensTitle: "Descubrimiento Cívico Descentralizado (ENSv2)",
      ensDesc:
        "Las encuestas se descubren mediante nombres legibles como venezuela2026.eth a través del Resolver Universal en Sepolia.",
    },
    footer: {
      rights: "VenekoVox — La Capa de Verdad para el Sentimiento Cívico.",
      about: "Documentación",
      github: "Repositorio en GitHub",
      journey: "Mapa Técnico de Flujos",
    },
  },
};

export default function VenekoVoxLandingPage() {
  const [language, setLanguage] = useState<"en" | "es">("es");
  const [showUnderTheHood, setShowUnderTheHood] = useState(false);
  const t = content[language];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Veneko<span className="text-blue-400">Vox</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-300">
            <a href="#threats" className="hover:text-white transition-colors">
              {t.nav.mission}
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              {t.nav.howItWorks}
            </a>
            <Link to="/polls" className="hover:text-white transition-colors">
              {t.nav.polls}
            </Link>
            <button
              onClick={() => {
                setShowUnderTheHood(true);
                setTimeout(() => {
                  document.getElementById("under-the-hood")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="hover:text-blue-400 transition-colors"
            >
              {t.nav.underTheHood}
            </button>
          </nav>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setLanguage((l) => (l === "en" ? "es" : "en"))}
              className="flex items-center space-x-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors px-3 py-1.5 rounded-full border border-slate-800 hover:border-slate-700 bg-slate-900/60"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>{language === "en" ? "ES" : "EN"}</span>
            </button>
            <Link
              to="/polls"
              className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow-sm transition"
            >
              <span>{t.nav.polls}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <nav
        aria-label="Private polling round"
        className="flex flex-wrap justify-center gap-5 px-6 py-3 border-b border-slate-800 text-sm text-lime-300"
      >
        <Link to="/account">{language === "en" ? "My account" : "Mi cuenta"}</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/journey">{language === "en" ? "Screen map & wiring" : "Mapa de pantallas y conexiones"}</Link>
      </nav>

      <p className="text-center text-sm text-amber-200 px-6 pt-5">
        {language === "en"
          ? "Development round: Privy and verified-human voting are not connected yet. The content below describes the intended product."
          : "Ronda de desarrollo: Privy y el voto con identidad verificada aún no están conectados. El contenido describe el producto previsto."}
      </p>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 max-w-5xl text-center relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-xs font-medium mb-6 animate-fade-in">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>{t.hero.badge}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            {t.hero.headline}
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            {t.hero.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {/* S2.2: /login is the explicit unconfigured Privy boundary; never simulate a session. */}
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center bg-lime-300 hover:bg-lime-200 text-black font-semibold py-3.5 px-8 rounded-xl"
            >
              {language === "en" ? "Log in with Privy" : "Iniciar sesión con Privy"}
            </Link>
            <Link
              to="/polls"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 px-8 rounded-xl shadow-lg shadow-blue-600/20 transition-all transform hover:-translate-y-0.5"
            >
              <span>{t.hero.ctaExplore}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 font-medium py-3.5 px-8 rounded-xl transition"
            >
              <span>{t.hero.ctaLearn}</span>
            </a>
          </div>
        </div>
      </section>

      {/* The Crisis / Threats Section */}
      <section id="threats" className="py-20 bg-slate-900/50 border-y border-slate-800/80">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2 block">
              {t.threats.tag}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t.threats.title}</h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">{t.threats.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition">
              <div>
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 mb-4">
                  {t.threats.card1.tag}
                </span>
                <h3 className="text-xl font-bold text-white mb-3">{t.threats.card1.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">{t.threats.card1.desc}</p>
              </div>
              <div className="pt-4 border-t border-slate-900 text-xs italic text-slate-500">
                "{t.threats.card1.quote}"
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition">
              <div>
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-4">
                  {t.threats.card2.tag}
                </span>
                <h3 className="text-xl font-bold text-white mb-3">{t.threats.card2.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">{t.threats.card2.desc}</p>
              </div>
              <div className="pt-4 border-t border-slate-900 text-xs italic text-slate-500">
                "{t.threats.card2.quote}"
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-8 flex flex-col justify-between hover:border-slate-700 transition">
              <div>
                <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-4">
                  {t.threats.card3.tag}
                </span>
                <h3 className="text-xl font-bold text-white mb-3">{t.threats.card3.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">{t.threats.card3.desc}</p>
              </div>
              <div className="pt-4 border-t border-slate-900 text-xs italic text-slate-500">
                "{t.threats.card3.quote}"
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2 block">
              {t.howItWorks.tag}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t.howItWorks.title}</h2>
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">{t.howItWorks.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[t.howItWorks.step1, t.howItWorks.step2, t.howItWorks.step3, t.howItWorks.step4].map((step, i) => (
              <div
                key={i}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-7 relative hover:border-slate-700 transition"
              >
                <div className="text-2xl font-black text-blue-500/40 mb-4 font-mono">{step.step}</div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guarantees Grid */}
      <section className="py-20 bg-slate-900/30 border-t border-slate-800/80">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2 block">
              {t.guarantees.tag}
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{t.guarantees.title}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {t.guarantees.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start space-x-4 p-5 rounded-xl bg-slate-900/40 border border-slate-800/60"
              >
                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base font-semibold text-white mb-1">{item.title}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Under The Hood Accordion / Section */}
      <section id="under-the-hood" className="py-16 border-t border-slate-800 bg-slate-950">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-8">
            <button
              onClick={() => setShowUnderTheHood(!showUnderTheHood)}
              className="inline-flex items-center space-x-2 text-sm font-semibold text-slate-400 hover:text-white transition px-4 py-2 rounded-full border border-slate-800 hover:border-slate-700 bg-slate-900/60"
            >
              <span>{t.underTheHood.title}</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${showUnderTheHood ? "rotate-180" : ""}`}
              />
            </button>
            <p className="text-xs text-slate-500 mt-2">{t.underTheHood.subtitle}</p>
          </div>

          {showUnderTheHood && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 animate-fade-in">
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
                <h4 className="text-base font-semibold text-white mb-2 flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-blue-400" />
                  <span>{t.underTheHood.zkIdentityTitle}</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{t.underTheHood.zkIdentityDesc}</p>
                <a
                  href="https://self.xyz"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-blue-400 hover:underline"
                >
                  <span>Self Protocol Docs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
                <h4 className="text-base font-semibold text-white mb-2 flex items-center space-x-2">
                  <EyeOff className="w-4 h-4 text-purple-400" />
                  <span>{t.underTheHood.maciTitle}</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{t.underTheHood.maciDesc}</p>
                <a
                  href="https://maci.pse.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-purple-400 hover:underline"
                >
                  <span>PSE MACI Research</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
                <h4 className="text-base font-semibold text-white mb-2 flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t.underTheHood.graphTitle}</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{t.underTheHood.graphDesc}</p>
                <a
                  href="https://thegraph.com"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-emerald-400 hover:underline"
                >
                  <span>The Graph & Messari Standard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
                <h4 className="text-base font-semibold text-white mb-2 flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>{t.underTheHood.ensTitle}</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">{t.underTheHood.ensDesc}</p>
                <a
                  href="https://docs.ens.domains"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:underline"
                >
                  <span>ENS Universal Resolver</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-800/80 bg-slate-950 text-xs text-slate-500">
        <div className="container mx-auto px-6 max-w-6xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>{t.footer.rights}</p>
          <div className="flex items-center space-x-6">
            <Link to="/polls" className="hover:text-slate-300 transition">
              {t.nav.polls}
            </Link>
            <Link to="/discover" className="hover:text-slate-300 transition">
              ENS Discovery
            </Link>
            <a
              href="https://github.com/satojandro/venekovox"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-300 transition"
            >
              {t.footer.github}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
