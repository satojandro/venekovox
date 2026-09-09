import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { RoundHome, RoundScreen, ScreenMap } from "./journey/Round";
import { screens } from "./journey/screens";
import Landing from "./pages/Landing";
import Polls from "./pages/Polls";
import Comments from "./pages/Comments";
import NamedPoll from "./pages/NamedPoll";
import Names from "./pages/Names";

// Load the voting page only when that route is opened. It imports the MACI
// SDK, which used to crash the entire site during startup.
const PollDetail = lazy(() => import("./pages/PollDetail"));

function App() {
  return (
    <div className="min-h-screen bg-veneko-background text-veneko-text">
      <Suspense fallback={<div className="min-h-screen bg-gray-900 text-white p-8 text-lg">Loading the page…</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/round" element={<RoundHome />} />
          <Route path="/about" element={<Landing />} />
          <Route path="/journey" element={<ScreenMap />} />
          {screens.map((screen) => (
            <Route key={screen.id} path={screen.path} element={screen.id === "name" ? <Names /> : <RoundScreen key={screen.id} id={screen.id} />} />
          ))}
          <Route path="/names" element={<Navigate to="/account/name" replace />} />
          <Route path="/discover" element={<NamedPoll />} />
          <Route path="/p/:name" element={<NamedPoll />} />
          <Route path="/polls" element={<Polls />} />
          <Route path="/polls/:id" element={<PollDetail />} />
          <Route path="/create-poll" element={<Navigate to="/admin/polls/new" replace />} />
          <Route path="/trust-ritual" element={<Navigate to="/account/identity" replace />} />
          <Route path="/comments" element={<Comments />} />
          <Route path="*" element={<Navigate to="/journey" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
