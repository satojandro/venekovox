import { useState } from 'react';
import { ThumbsUp, ThumbsDown, ChevronDown, Send } from 'lucide-react';

// --- MOCK DATA ---
const mockCommentsData = [
  {
    id: 1,
    user: "Anonymous #847",
    timestamp: { en: "3h ago", es: "hace 3h" },
    text: {
      en: "This is the most critical issue facing our economy. Complete dollarization is the only way to stop hyperinflation for good.",
      es: "Este es el problema más crítico que enfrenta nuestra economía. La dolarización completa es la única forma de detener la hiperinflación para siempre."
    },
    upvotes: 128,
    downvotes: 12,
    replies: [
      {
        id: 2,
        user: "Anonymous #102",
        timestamp: { en: "2h ago", es: "hace 2h" },
        text: {
          en: "I disagree. We would lose all monetary sovereignty. The government needs to focus on fiscal discipline, not give up our currency.",
          es: "No estoy de acuerdo. Perderíamos toda soberanía monetaria. El gobierno debe centrarse en la disciplina fiscal, no en renunciar a nuestra moneda."
        },
        upvotes: 45,
        downvotes: 5,
        replies: [
           {
            id: 3,
            user: "Anonymous #847",
            timestamp: { en: "1h ago", es: "hace 1h" },
            text: {
              en: "What sovereignty? It's been mismanaged for decades. A stable currency would attract investment and allow people to actually save.",
              es: "¿Qué soberanía? Ha sido mal administrada durante décadas. Una moneda estable atraería inversiones y permitiría a la gente ahorrar de verdad."
            },
            upvotes: 72,
            downvotes: 2,
            replies: []
          }
        ]
      },
       {
        id: 4,
        user: "Anonymous #331",
        timestamp: { en: "2h ago", es: "hace 2h" },
        text: {
          en: "Good point, but fiscal discipline seems like a fantasy right now. We need a practical solution immediately.",
          es: "Buen punto, pero la disciplina fiscal parece una fantasía en este momento. Necesitamos una solución práctica de inmediato."
        },
        upvotes: 33,
        downvotes: 1,
        replies: []
      }
    ]
  },
  {
    id: 5,
    user: "Anonymous #556",
    timestamp: { en: "8h ago", es: "hace 8h" },
    text: {
      en: "Has anyone considered a hybrid model? Use the dollar for large transactions but keep the Bolívar for daily local commerce to maintain some control?",
      es: "¿Alguien ha considerado un modelo híbrido? Usar el dólar para grandes transacciones pero mantener el Bolívar para el comercio local diario para mantener algo de control."
    },
    upvotes: 98,
    downvotes: 3,
    replies: []
  }
];


// --- LANGUAGE CONTENT ---
const content = {
  en: {
    title: "Join the Conversation",
    subtitle: "Anonymous & Uncensored",
    inputPlaceholder: "Share your thoughts...",
    postButton: "Post Comment",
    disclaimer: "Your identity will remain anonymous.",
    sortBy: "Sort by:",
    sortOptions: {
      top: "Top",
      new: "New"
    },
    reply: "Reply"
  },
  es: {
    title: "Únete a la Conversación",
    subtitle: "Anónimo y Sin Censura",
    inputPlaceholder: "Comparte tu opinión...",
    postButton: "Publicar Comentario",
    disclaimer: "Tu identidad permanecerá anónima.",
    sortBy: "Ordenar por:",
    sortOptions: {
      top: "Más Votados",
      new: "Más Recientes"
    },
    reply: "Responder"
  },
};

// --- TYPES ---
interface CommentData {
  id: number;
  user: string;
  timestamp: { en: string; es: string };
  text: { en: string; es: string };
  upvotes: number;
  downvotes: number;
  replies: CommentData[];
}

interface CommentProps {
  comment: CommentData;
  language: 'en' | 'es';
  level?: number;
}

// --- RECURSIVE COMMENT COMPONENT ---
const Comment: React.FC<CommentProps> = ({ comment, language, level = 0 }) => {
  const currentContent = content[language];
  return (
    <div className={`flex items-start space-x-3 ${level > 0 ? 'ml-4 sm:ml-6 mt-4' : 'mt-6'}`}>
      {level > 0 && <div className="w-px bg-gray-700 h-full absolute -left-3 top-0"></div>}
      <div className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full"></div>
      <div className="flex-1 relative">
        <div className="flex items-center space-x-2 text-sm mb-1">
          <span className="font-semibold text-blue-300">{comment.user}</span>
          <span className="text-gray-500">·</span>
          <span className="text-gray-500">{comment.timestamp[language]}</span>
        </div>
        <p className="text-gray-300 text-sm leading-relaxed">{comment.text[language]}</p>
        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
          <button className="flex items-center space-x-1 hover:text-green-400">
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>{comment.upvotes}</span>
          </button>
           <button className="flex items-center space-x-1 hover:text-red-400">
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>{comment.downvotes}</span>
          </button>
          <button className="font-semibold hover:text-white">{currentContent.reply}</button>
        </div>

        <div className="relative">
          {comment.replies && comment.replies.map(reply => (
            <Comment key={reply.id} comment={reply} language={language} level={level + 1} />
          ))}
        </div>
      </div>
    </div>
  );
};


// --- MAIN COMPONENT ---
export default function CommentsSection() {
  const [language, setLanguage] = useState<'en' | 'es'>('es');
  const [comments, setComments] = useState<CommentData[]>(mockCommentsData);
  const currentContent = content[language];

  return (
    <div className="bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">{currentContent.title}</h2>
          <p className="text-gray-400">{currentContent.subtitle}</p>
        </div>

        {/* New Comment Input */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-8">
            <textarea
                className="w-full bg-transparent text-white placeholder-gray-500 focus:outline-none resize-none"
                rows="3"
                placeholder={currentContent.inputPlaceholder}
            ></textarea>
            <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-500">{currentContent.disclaimer}</p>
                <button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 transition">
                    <span>{currentContent.postButton}</span>
                    <Send className="w-4 h-4"/>
                </button>
            </div>
        </div>

        {/* Sort and Comments */}
        <div className="border-t border-gray-800 pt-6">
            <div className="flex items-center justify-end mb-4">
                <label className="text-sm text-gray-400 mr-2">{currentContent.sortBy}</label>
                <div className="relative">
                    <select className="bg-gray-800 border border-gray-700 rounded-md py-1 pl-3 pr-8 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                        <option>{currentContent.sortOptions.top}</option>
                        <option>{currentContent.sortOptions.new}</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>

            {/* Comments List */}
            <div>
              {comments.map(comment => (
                <Comment key={comment.id} comment={comment} language={language} />
              ))}
            </div>
        </div>

      </div>
    </div>
  );
}
