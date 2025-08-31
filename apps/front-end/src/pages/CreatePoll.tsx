import { useState } from "react";
import { Shield, Globe, Plus, Trash2, Calendar, Clock, CheckCircle } from "lucide-react";

// --- LANGUAGE CONTENT ---
const content = {
  en: {
    brand: "VenekoVox",
    pageTitle: "Create a New Poll",
    subTitle: "Shape the conversation. Your questions empower the community's voice.",
    toggle: { es: "ES", en: "EN" },
    form: {
      pollTitle: "Poll Title",
      description: "Description",
      topic: "Topic",
      country: "Country",
      showDemographics: "Show age & gender breakdown in poll results (optional)",
      allowGlobal: "Allow global participation (votes from other countries will be shown separately)",
      votingOptions: "Voting Options",
      addOption: "Add Option",
      externalResource: "External Resource (URL) – optional",
      schedule: "Schedule",
      openNow: "Open Now",
      setDate: "Set Date Range",
      submit: "Create Poll",
    },
    placeholders: {
      title: "e.g., Do you support dollarization?",
      description: "Provide context for the poll...",
      selectTopic: "Select a topic",
      selectCountry: "Select a country",
      option: "e.g., Yes, No, Abstain",
      externalUrl: "https://example.com/resource",
    },
    topics: ["Politics", "Economy", "Culture", "Social Issues", "Technology"],
    countries: ["Venezuela", "Colombia", "Argentina", "Mexico", "Brazil", "Chile"],
    toast: "Poll created successfully!",
  },
  es: {
    brand: "VenekoVox",
    pageTitle: "Crear Nueva Encuesta",
    subTitle: "Modela la conversación. Tus preguntas empoderan la voz de la comunidad.",
    toggle: { es: "ES", en: "EN" },
    form: {
      pollTitle: "Título de la Encuesta",
      description: "Descripción",
      topic: "Tema",
      country: "País",
      showDemographics: "Mostrar desglose por edad y género en los resultados (opcional)",
      allowGlobal: "Permitir participación global (los votos de otros países se mostrarán por separado)",
      votingOptions: "Opciones de Voto",
      addOption: "Añadir Opción",
      externalResource: "Recurso Externo (URL) – opcional",
      schedule: "Programación",
      openNow: "Abrir Ahora",
      setDate: "Establecer Rango de Fechas",
      submit: "Crear Encuesta",
    },
    placeholders: {
      title: "Ej: ¿Apoya la dolarización?",
      description: "Proporciona contexto para la encuesta...",
      selectTopic: "Selecciona un tema",
      selectCountry: "Selecciona un país",
      option: "Ej: Sí, No, Abstenerse",
      externalUrl: "https://ejemplo.com/recurso",
    },
    topics: ["Política", "Economía", "Cultura", "Asuntos Sociales", "Tecnología"],
    countries: ["Venezuela", "Colombia", "Argentina", "México", "Brasil", "Chile"],
    toast: "¡Encuesta creada con éxito!",
  },
};

// --- HELPER COMPONENTS ---
interface BilingualInputProps {
  label: string;
  placeholder: string;
  lang: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const BilingualInput: React.FC<BilingualInputProps> = ({ label, placeholder, lang, value = "", onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {label} ({lang.toUpperCase()})
    </label>
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

interface BilingualTextareaProps {
  label: string;
  placeholder: string;
  lang: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const BilingualTextarea: React.FC<BilingualTextareaProps> = ({ label, placeholder, lang, value = "", onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1">
      {label} ({lang.toUpperCase()})
    </label>
    <textarea
      placeholder={placeholder}
      rows={3}
      value={value}
      onChange={onChange}
      className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

// --- MAIN COMPONENT ---
export default function CreatePollPage() {
  const [language, setLanguage] = useState("es");
  const [showToast, setShowToast] = useState(false);
  const [scheduleType, setScheduleType] = useState("now");
  const [allowGlobal, setAllowGlobal] = useState(false);
  const [showDemographics, setShowDemographics] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [options, setOptions] = useState([
    { en: "Yes", es: "Sí" },
    { en: "No", es: "No" },
    { en: "Abstain", es: "Abstenerse" },
  ]);
  const currentContent = content[language];

  const handleAddOption = () => {
    setOptions([...options, { en: "", es: "" }]);
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };

  const handleOptionChange = (index: number, lang: string, value: string) => {
    const newOptions = [...options];
    newOptions[index][lang] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    // In a real app, you'd collect form data and send to a server here
  };

  return (
    <div className="bg-gray-900 text-gray-200 min-h-screen font-sans">
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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">{currentContent.pageTitle}</h1>
            <p className="text-gray-400">{currentContent.subTitle}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-gray-800/50 p-6 sm:p-8 rounded-xl border border-gray-700 space-y-8"
          >
            {/* Poll Title & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BilingualInput
                label={currentContent.form.pollTitle}
                placeholder={currentContent.placeholders.title}
                lang="en"
              />
              <BilingualInput
                label={currentContent.form.pollTitle}
                placeholder={currentContent.placeholders.title}
                lang="es"
              />
              <BilingualTextarea
                label={currentContent.form.description}
                placeholder={currentContent.placeholders.description}
                lang="en"
              />
              <BilingualTextarea
                label={currentContent.form.description}
                placeholder={currentContent.placeholders.description}
                lang="es"
              />
            </div>

            {/* Topic & Country */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">{currentContent.form.topic}</label>
                  <select className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>{currentContent.placeholders.selectTopic}</option>
                    {content.en.topics.map((topic, i) => (
                      <option key={topic}>{language === "en" ? topic : content.es.topics[i]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">{currentContent.form.country}</label>
                  <select className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>{currentContent.placeholders.selectCountry}</option>
                    {currentContent.countries.map((country) => (
                      <option key={country}>{country}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Allow Global Participation Toggle */}
              <div className="mt-4">
                <label
                  className="flex items-center space-x-3 cursor-pointer"
                  onClick={() => setAllowGlobal(!allowGlobal)}
                >
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={allowGlobal} readOnly />
                    <div
                      className={`block w-10 h-6 rounded-full transition ${allowGlobal ? "bg-blue-600" : "bg-gray-600"}`}
                    ></div>
                    <div
                      className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${allowGlobal ? "translate-x-4" : ""}`}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-300 select-none">{currentContent.form.allowGlobal}</span>
                </label>
              </div>
            </div>

            {/* Demographics Toggle */}
            <div>
              <label
                className="flex items-center space-x-3 cursor-pointer"
                onClick={() => setShowDemographics(!showDemographics)}
              >
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={showDemographics} readOnly />
                  <div
                    className="block w-10 h-6 rounded-full transition"
                    style={{ backgroundColor: showDemographics ? "#2563eb" : "#4b5563" }}
                  ></div>
                  <div
                    className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showDemographics ? "translate-x-4" : ""}`}
                  ></div>
                </div>
                <span className="text-sm text-gray-300 select-none">{currentContent.form.showDemographics}</span>
              </label>
            </div>

            {/* Voting Options */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {currentContent.form.votingOptions}
              </label>
              <div className="space-y-3">
                {options.map((opt, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder={`${currentContent.placeholders.option} (EN)`}
                      value={opt.en}
                      onChange={(e) => handleOptionChange(index, "en", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder={`${currentContent.placeholders.option} (ES)`}
                      value={opt.es}
                      onChange={(e) => handleOptionChange(index, "es", e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(index)}
                      className="p-2 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-3 flex items-center space-x-2 text-sm text-blue-400 hover:text-blue-300"
              >
                <Plus className="w-4 h-4" />
                <span>{currentContent.form.addOption}</span>
              </button>
            </div>

            {/* External Resource URL */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                {currentContent.form.externalResource}
              </label>
              <input
                type="url"
                placeholder={currentContent.placeholders.externalUrl}
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{currentContent.form.schedule}</label>
              <div className="flex items-center space-x-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="schedule"
                    value="now"
                    checked={scheduleType === "now"}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="mr-2"
                  />
                  {currentContent.form.openNow}
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="schedule"
                    value="later"
                    checked={scheduleType === "later"}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="mr-2"
                  />
                  {currentContent.form.setDate}
                </label>
              </div>
              {scheduleType === "later" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-800 rounded-md">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Start Date</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">End Date</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-gray-700">
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition duration-300"
              >
                {currentContent.form.submit}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg flex items-center space-x-2 shadow-lg animate-pulse">
          <CheckCircle className="w-5 h-5" />
          <span>{currentContent.toast}</span>
        </div>
      )}
    </div>
  );
}
