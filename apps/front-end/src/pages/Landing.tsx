import { useState } from 'react';
import { Shield, Globe, Users, Vote, BarChart2, ScanLine, Lock, Send } from 'lucide-react';

// --- BILINGUAL CONTENT OBJECT ---
const content = {
  en: {
    nav: { mission: "Mission", howItWorks: "How It Works", polls: "Polls" },
    hero: {
      headline: "Anonymous. Verified. Heard.",
      subheadline: "VenekoVox lets you speak your truth—without fear, without censorship. Built from exile, for dignity.",
      ctaVote: "Start Voting Now",
      ctaCreate: "Create a Poll",
    },
    impact: {
      voices: "Verified Voices",
      countries: "Countries",
      polls: "Active Polls",
    },
    trustedBy: "Trusted by the Pioneers of Privacy",
    howItWorks: {
      title: "Your Voice, Secured in Three Steps",
      step1: {
        title: "Verify Your ID",
        desc: "Use your passport or national ID with Self.xyz. We never see your data, only a cryptographic proof of your uniqueness.",
      },
      step2: {
        title: "Vote on Real Issues",
        desc: "Participate in polls that matter to your community and country. Your vote is cast anonymously using MACI technology.",
      },
      step3: {
        title: "See Immutable Results",
        desc: "Results are transparent, verifiable, and permanently stored on decentralized networks like IPFS & Filecoin.",
      },
    },
    testimonials: {
      title: "The Uncensored Voice of a Community",
      quotes: [
        { text: "For the first time in 25 years, I feel like my vote actually counts.", author: "Anonymous, Venezuela" },
        { text: "This is what digital democracy is supposed to look like. Secure, private, and powerful.", author: "Anonymous, Colombia" },
        { text: "Anonymous, but not silent. This platform gives us our voice back.", author: "Anonymous, Argentina" },
      ],
    },
    join: {
      title: "Join the Movement",
      subheadline: "Stay updated on new polls, results, and the future of decentralized civic tech.",
      placeholder: "Enter your email address",
      button: "Subscribe",
    },
    footer: {
      about: "About",
      privacy: "Privacy",
      contact: "Contact",
      rights: "VenekoVox. All rights reserved.",
    }
  },
  es: {
    nav: { mission: "Misión", howItWorks: "Cómo Funciona", polls: "Encuestas" },
    hero: {
      headline: "Anónimo. Verificado. Escuchado.",
      subheadline: "VenekoVox te permite decir tu verdad—sin miedo, sin censura. Creado desde el exilio, para la dignidad.",
      ctaVote: "Empieza a Votar",
      ctaCreate: "Crear una Encuesta",
    },
    impact: {
      voices: "Voces Verificadas",
      countries: "Países",
      polls: "Encuestas Activas",
    },
    trustedBy: "Con la Confianza de los Pioneros de la Privacidad",
    howItWorks: {
      title: "Tu Voz, Asegurada en Tres Pasos",
      step1: {
        title: "Verifica tu Identidad",
        desc: "Usa tu pasaporte o ID nacional con Self.xyz. Nunca vemos tus datos, solo una prueba criptográfica de tu unicidad.",
      },
      step2: {
        title: "Vota en Asuntos Reales",
        desc: "Participa en encuestas importantes para tu comunidad y país. Tu voto se emite anónimamente usando tecnología MACI.",
      },
      step3: {
        title: "Consulta Resultados Inmutables",
        desc: "Los resultados son transparentes, verificables y se almacenan permanentemente en redes descentralizadas como IPFS y Filecoin.",
      },
    },
    testimonials: {
      title: "La Voz Sin Censura de una Comunidad",
      quotes: [
        { text: "Por primera vez en 25 años, siento que mi voto realmente cuenta.", author: "Anónimo, Venezuela" },
        { text: "Así es como se debe ver la democracia digital. Segura, privada y poderosa.", author: "Anónimo, Colombia" },
        { text: "Anónimo, pero no silente. Esta plataforma nos devuelve la voz.", author: "Anónimo, Argentina" },
      ],
    },
    join: {
      title: "Únete al Movimiento",
      subheadline: "Mantente actualizado sobre nuevas encuestas, resultados y el futuro de la tecnología cívica descentralizada.",
      placeholder: "Ingresa tu correo electrónico",
      button: "Suscribirse",
    },
    footer: {
      about: "Acerca de",
      privacy: "Privacidad",
      contact: "Contacto",
      rights: "VenekoVox. Todos los derechos reservados.",
    }
  },
};

// --- SVG COMPONENTS ---
const TechLogo = ({ children }) => <div className="h-8 text-gray-400 filter grayscale hover:grayscale-0 transition duration-300">{children}</div>;
const MACILogo = () => <TechLogo><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>MACI</title><path d="M12 0L1.606 6v12L12 24l10.394-6V6L12 0zm-1.04 4.544h2.08v14.912h-2.08V4.544zM4.909 7.636l2.122-1.226 7.456 12.91-2.12 1.227-7.458-12.91zM16.969 6.41l2.121 1.226-7.456 12.91-2.12-1.227 7.455-12.91z"/></svg></TechLogo>;
const SemaphoreLogo = () => <TechLogo><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>Semaphore</title><path d="M12 0L2.78 5.333v13.334L12 24l9.22-5.32V5.333L12 0zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6S6.698 2.4 12 2.4s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6zM12 4.114a.754.754 0 00-.652.376l-5.486 9.502a.752.752 0 00.652 1.128h10.972a.752.752 0 00.652-1.128l-5.486-9.502a.754.754 0 00-.652-.376zM12 14.726L12 14.726l-2.68 1.937v-3.87l2.68 2.247 2.68-2.247v3.87z"/></svg></TechLogo>;
const SelfIDLogo = () => <TechLogo><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>Self.ID</title><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4.068c2.19 0 3.966 1.776 3.966 3.966s-1.776 3.966-3.966 3.966-3.966-1.776-3.966-3.966S9.81 4.068 12 4.068zm0 15.864c-3.28 0-6.13-1.89-7.555-4.697.16-.948 2.51-3.08 7.555-3.08s7.395 2.132 7.555 3.08c-1.425 2.808-4.275 4.698-7.555 4.698z"/></svg></TechLogo>;
const FilecoinLogo = () => <TechLogo><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>Filecoin</title><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6S6.698 2.4 12 2.4s9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6zM12 4.114a.754.754 0 00-.652.376l-5.486 9.502a.752.752 0 00.652 1.128h10.972a.752.752 0 00.652-1.128l-5.486-9.502a.754.754 0 00-.652-.376z"/></svg></TechLogo>;
const IPFSLogo = () => <TechLogo><svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><title>IPFS</title><path d="M12 0L2.78 5.333v13.334L12 24l9.22-5.333V5.333L12 0zm-1.04 4.545h2.08v14.91h-2.08v-14.91zm-4.24 2.122l2.12 1.226v10.057l-2.12-1.226V6.667zm8.48 0v10.057l-2.12 1.226V7.893l2.12-1.226z"/></svg></TechLogo>;


// --- MAIN COMPONENT ---
export default function VenekoVoxLandingPage() {
  const [language, setLanguage] = useState('es');
  const currentContent = content[language];

  return (
    <>
      <style>{`
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .animate-ripple { animation: ripple 2s infinite ease-out; }
      `}</style>

      <div className="bg-black text-gray-200 font-sans antialiased">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20">
          <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Shield className="w-7 h-7 text-blue-400" />
              <span className="text-xl font-bold tracking-wider text-white">VenekoVox</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-sm text-gray-300 hover:text-white transition-colors">{currentContent.nav.mission}</a>
              <a href="#" className="text-sm text-gray-300 hover:text-white transition-colors">{currentContent.nav.howItWorks}</a>
              <a href="#" className="text-sm text-gray-300 hover:text-white transition-colors">{currentContent.nav.polls}</a>
            </nav>
            <button
              onClick={() => setLanguage(l => l === 'en' ? 'es' : 'en')}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors p-2 rounded-md border border-gray-700 hover:border-gray-500"
            >
              <Globe className="w-4 h-4" />
              <span className="font-semibold text-xs">{language === 'en' ? 'ESPAÑOL' : 'ENGLISH'}</span>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative h-screen flex items-center justify-center text-center overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-60 z-10"></div>
          <div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage: "url('https://images.unsplash.com/photo-1590779720839-50b86a343603?auto=format&fit=crop&w=1500&q=80')"}}></div>
           {/* Animated map would go here, for now a visual placeholder */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <div className="relative">
                  <div className="absolute w-64 h-64 border-2 border-blue-500 rounded-full animate-ripple" style={{animationDelay: '0s'}}></div>
                  <div className="absolute w-64 h-64 border-2 border-blue-400 rounded-full animate-ripple" style={{animationDelay: '1s'}}></div>
              </div>
          </div>
          <div className="relative z-10 px-6 max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
              {currentContent.hero.headline}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              {currentContent.hero.subheadline}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg transition-transform transform hover:scale-105">
                {currentContent.hero.ctaVote}
              </a>
              <a href="#" className="w-full sm:w-auto bg-gray-800/50 border border-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg transition">
                {currentContent.hero.ctaCreate}
              </a>
            </div>
          </div>
        </section>

        {/* Impact Bar */}
        <div className="bg-gray-900/70 backdrop-blur-sm py-8">
            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
                    <div className="border-r border-gray-800 last:border-r-0 sm:last:border-r-0">
                        <h3 className="text-4xl font-bold text-white">1,283</h3>
                        <p className="text-sm text-gray-400 mt-1">{currentContent.impact.voices}</p>
                    </div>
                    <div className="border-r border-gray-800 last:border-r-0 sm:last:border-r-0">
                        <h3 className="text-4xl font-bold text-white">16</h3>
                        <p className="text-sm text-gray-400 mt-1">{currentContent.impact.countries}</p>
                    </div>
                    <div>
                        <h3 className="text-4xl font-bold text-white">28</h3>
                        <p className="text-sm text-gray-400 mt-1">{currentContent.impact.polls}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Trusted By Section */}
        <section className="py-12 bg-black">
          <div className="container mx-auto px-6 text-center">
            <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">{currentContent.trustedBy}</h4>
            <div className="flex justify-center items-center flex-wrap gap-x-10 gap-y-6">
                <MACILogo/>
                <SemaphoreLogo/>
                <SelfIDLogo/>
                <FilecoinLogo/>
                <IPFSLogo/>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gray-900">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-4xl font-extrabold text-white">{currentContent.howItWorks.title}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[currentContent.howItWorks.step1, currentContent.howItWorks.step2, currentContent.howItWorks.step3].map((step, i) => (
                <div key={i} className="bg-gray-800/50 p-8 rounded-xl border border-gray-700">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 bg-gray-700 rounded-full border-2 border-blue-500 text-blue-300 font-bold text-2xl">
                    {i + 1}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 bg-black">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <h2 className="text-4xl font-extrabold text-white">{currentContent.testimonials.title}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {currentContent.testimonials.quotes.map((quote, i) => (
                        <div key={i} className="bg-gray-900 p-8 rounded-lg border border-gray-800">
                            <p className="text-lg italic text-gray-300 mb-6">"{quote.text}"</p>
                            <p className="font-semibold text-blue-400">{quote.author}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>

        {/* Join the Movement Section */}
        <section className="py-20 bg-gray-900">
          <div className="container mx-auto px-6 text-center max-w-3xl">
            <h2 className="text-4xl font-extrabold text-white">{currentContent.join.title}</h2>
            <p className="mt-4 text-gray-400">{currentContent.join.subheadline}</p>
            <form className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <input type="email" placeholder={currentContent.join.placeholder} className="flex-grow w-full bg-gray-800 border border-gray-600 rounded-md py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-md transition-transform transform hover:scale-105">
                {currentContent.join.button}
              </button>
            </form>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-black border-t border-gray-800">
            <div className="container mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center text-sm">
                <p className="text-gray-500 mb-4 sm:mb-0">&copy; {new Date().getFullYear()} {currentContent.footer.rights}</p>
                <div className="flex items-center space-x-6 text-gray-400">
                    <a href="#" className="hover:text-white transition">{currentContent.footer.about}</a>
                    <a href="#" className="hover:text-white transition">{currentContent.footer.privacy}</a>
                    <a href="#" className="hover:text-white transition">{currentContent.footer.contact}</a>
                </div>
            </div>
        </footer>
      </div>
    </>
  );
}
