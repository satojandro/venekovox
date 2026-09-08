import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Landing from "./pages/Landing";
import Polls from "./pages/Polls";
import Auth from "./pages/Auth";
import Comments from "./pages/Comments";
import CreatePoll from "./pages/CreatePoll";
import NamedPoll from "./pages/NamedPoll";

// Load the voting page only when that route is opened. It imports the MACI
// SDK, which used to crash the entire site during startup.
const PollDetail = lazy(() => import("./pages/PollDetail"));

function App() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-veneko-background text-veneko-text">
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-900 text-white p-8 text-lg">
            Loading the page…
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/discover" element={<NamedPoll />} />
          <Route path="/p/:name" element={<NamedPoll />} />
          <Route path="/polls" element={<Polls />} />
          <Route path="/polls/:id" element={<PollDetail />} />
          <Route path="/create-poll" element={<CreatePoll />} />
          <Route path="/trust-ritual" element={<Auth />} />
          <Route path="/comments" element={<Comments />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
