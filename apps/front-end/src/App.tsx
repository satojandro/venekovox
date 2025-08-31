import { Routes, Route } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Landing from './pages/Landing'
import Polls from './pages/Polls'
import Auth from './pages/Auth'
import Comments from './pages/Comments'
import PollDetail from './pages/PollDetail'
import CreatePoll from './pages/CreatePoll'

function App() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-veneko-background text-veneko-text">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/polls" element={<Polls />} />
        <Route path="/polls/:id" element={<PollDetail />} />
        <Route path="/create-poll" element={<CreatePoll />} />
        <Route path="/trust-ritual" element={<Auth />} />
        <Route path="/comments" element={<Comments />} />
      </Routes>
    </div>
  )
}

export default App
