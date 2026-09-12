import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Polls from "./pages/Polls";
import Auth from "./pages/Auth";
import Comments from "./pages/Comments";
import CreatePoll from "./pages/CreatePoll";
import NamedPoll from "./pages/NamedPoll";
import Names from "./pages/Names";
import Journal from "./pages/Journal";
import { Experience } from "./components/Experience";

const PollDetail = lazy(() => import("./pages/PollDetail"));

function App() {
  return (
    <Experience>
      <Suspense fallback={<div className="page-loading">Loading this page…</div>}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/discover" element={<NamedPoll />} />
          <Route path="/p/:name" element={<NamedPoll />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/names" element={<Names />} />
          <Route path="/polls" element={<Polls />} />
          <Route path="/polls/:id" element={<PollDetail />} />
          <Route path="/create-poll" element={<CreatePoll />} />
          <Route path="/trust-ritual" element={<Auth />} />
          <Route path="/comments" element={<Comments />} />
        </Routes>
      </Suspense>
    </Experience>
  );
}

export default App;
